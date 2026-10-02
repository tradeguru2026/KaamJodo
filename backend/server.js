const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase environment variables missing");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);


// =====================================
// FRONTEND
// =====================================

const FRONTEND_PATH = path.join(__dirname, "..");

app.use(express.static(FRONTEND_PATH));

app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});


// =====================================
// HEALTH
// =====================================

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Hey Karigar API healthy"
  });
});


// =====================================
// API HOME
// =====================================

app.get("/api", (req, res) => {
  res.json({
    app: "Hey Karigar API",
    status: "running",
    version: "1.1.0"
  });
});


// =====================================
// SIGNUP
// =====================================

app.post("/api/auth/signup", async (req, res) => {
  try {

    const {
      name,
      email,
      phone,
      password,
      role,
      service,
      location,
      latitude,
      longitude
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, password aur role zaroori hain"
      });
    }

    const cleanEmail =
      String(email).trim().toLowerCase();

    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true
      });

    if (userError) {

      console.error(
        "❌ SIGNUP AUTH ERROR:",
        userError
      );

      return res.status(400).json({
        success: false,
        message: userError.message,
        actualError: userError.message,
        code: userError.code,
        details: userError.details,
        hint: userError.hint
      });
    }

    const userId =
      userData.user.id;

    const profileData = {
      id: userId,

      name:
        String(name).trim(),

      email:
        cleanEmail,

      phone:
        phone
          ? String(phone).trim()
          : null,

      role:
        String(role).trim(),

      service:
        service
          ? String(service).trim()
          : null,

      location:
        location
          ? String(location).trim()
          : null
    };


    // =====================================
    // LOCATION
    // =====================================

    const lat =
      Number(latitude);

    const lng =
      Number(longitude);

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {

      profileData.latitude = lat;
      profileData.longitude = lng;
      profileData.location_updated_at =
        new Date().toISOString();

    }


    const {
      data: profile,
      error: profileError
    } =
      await supabase
        .from("profiles")
        .insert([
          profileData
        ])
        .select()
        .single();


    if (profileError) {

      console.error(
        "❌ SIGNUP PROFILE ERROR:",
        profileError
      );

      return res.status(400).json({
        success: false,
        message:
          profileError.message,
        actualError:
          profileError.message,
        code:
          profileError.code,
        details:
          profileError.details,
        hint:
          profileError.hint
      });
    }


    return res.json({
      success: true,
      message: "Signup successful",
      profile: profile
    });

  } catch (error) {

    console.error(
      "❌ SIGNUP SERVER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Signup failed",
      actualError:
        error.message
    });
  }
});


// =====================================
// LOGIN
// =====================================

app.post("/api/auth/login", async (req, res) => {
  try {

    const {
      email,
      password
    } = req.body;

    if (!email || !password) {

      return res.status(400).json({
        success: false,
        message:
          "Email aur password zaroori hain"
      });

    }

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();


    const {
      data,
      error
    } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });


    if (error) {

      console.error(
        "❌ LOGIN ERROR:",
        error
      );

      return res.status(401).json({
        success: false,
        message:
          "Email ya password galat hai",
        actualError:
          error.message
      });

    }


    const {
      data: profile,
      error: profileError
    } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();


    if (profileError) {

      console.error(
        "❌ LOGIN PROFILE ERROR:",
        profileError
      );

      return res.status(400).json({
        success: false,
        message:
          "Profile nahi mili",
        actualError:
          profileError.message,
        code:
          profileError.code,
        details:
          profileError.details,
        hint:
          profileError.hint
      });

    }


    return res.json({
      success: true,
      message:
        "Login successful",
      session:
        data.session,
      profile:
        profile
    });


  } catch (error) {

    console.error(
      "❌ LOGIN SERVER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Login failed",
      actualError:
        error.message
    });

  }
});


// =====================================
// PROFILE
// =====================================

app.get(
  "/api/profile/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;


      const {
        data,
        error
      } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .single();


      if (error) {

        console.error(
          "❌ PROFILE ERROR:",
          error
        );

        return res.status(404).json({
          success: false,
          message:
            "Profile nahi mili",
          actualError:
            error.message,
          code:
            error.code,
          details:
            error.details,
          hint:
            error.hint
        });

      }


      return res.json({
        success: true,
        profile:
          data
      });


    } catch (error) {

      console.error(
        "❌ PROFILE SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
        actualError:
          error.message
      });

    }
  }
);


// =====================================
// UPDATE PROFILE LOCATION
// =====================================

app.patch(
  "/api/profile/:id/location",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const {
        location,
        latitude,
        longitude
      } = req.body;


      const lat =
        Number(latitude);

      const lng =
        Number(longitude);


      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Valid latitude aur longitude zaroori hain"
        });

      }


      const updateData = {

        latitude: lat,

        longitude: lng,

        location_updated_at:
          new Date().toISOString()

      };


      if (location) {

        updateData.location =
          String(location).trim();

      }


      const {
        data,
        error
      } =
        await supabase
          .from("profiles")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();


      if (error) {

        console.error(
          "❌ UPDATE LOCATION ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            error.message,
          actualError:
            error.message,
          code:
            error.code,
          details:
            error.details,
          hint:
            error.hint
        });

      }


      return res.json({
        success: true,
        message:
          "Location updated successfully",
        profile:
          data
      });


    } catch (error) {

      console.error(
        "❌ UPDATE LOCATION SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Location update failed",
        actualError:
          error.message
      });

    }
  }
);


// =====================================
// CREATE SERVICE REQUEST
// =====================================

app.post(
  "/api/requests",
  async (req, res) => {

    try {

      console.log(
        "================================="
      );

      console.log(
        "📥 NEW REQUEST RECEIVED"
      );

      console.log(
        "REQUEST BODY:",
        JSON.stringify(req.body)
      );


      const {
        name,
        phone,
        location,
        service,
        details,
        latitude,
        longitude
      } = req.body;


      // =====================================
      // VALIDATION
      // =====================================

      if (!name) {

        return res.status(400).json({
          success: false,
          message:
            "Customer name missing",
          actualError:
            "name is required"
        });

      }


      if (!phone) {

        return res.status(400).json({
          success: false,
          message:
            "Phone number missing",
          actualError:
            "phone is required"
        });

      }


      if (!location) {

        return res.status(400).json({
          success: false,
          message:
            "Location missing",
          actualError:
            "location is required"
        });

      }


      if (!service) {

        return res.status(400).json({
          success: false,
          message:
            "Service missing",
          actualError:
            "service is required"
        });

      }


      const requestData = {

        name:
          String(name).trim(),

        phone:
          String(phone).trim(),

        location:
          String(location).trim(),

        service:
          String(service).trim(),

        details:
          details
            ? String(details).trim()
            : "",

        status:
          "New"

      };


      // =====================================
      // CUSTOMER GPS LOCATION
      // =====================================

      const lat =
        Number(latitude);

      const lng =
        Number(longitude);


      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {

        requestData.latitude =
          lat;

        requestData.longitude =
          lng;

        requestData.location_updated_at =
          new Date().toISOString();

      }


      console.log(
        "📤 SUPABASE INSERT DATA:",
        JSON.stringify(requestData)
      );


      const {
        data,
        error
      } =
        await supabase
          .from("service_requests")
          .insert([
            requestData
          ])
          .select()
          .single();


      if (error) {

        console.error(
          "❌❌❌ SUPABASE INSERT ERROR ❌❌❌"
        );

        console.error(
          "MESSAGE:",
          error.message
        );

        console.error(
          "CODE:",
          error.code
        );

        console.error(
          "DETAILS:",
          error.details
        );

        console.error(
          "HINT:",
          error.hint
        );


        return res.status(500).json({
          success: false,
          message:
            error.message ||
            "Request save nahi hui",
          actualError:
            error.message ||
            "Unknown Supabase error",
          code:
            error.code ||
            null,
          details:
            error.details ||
            null,
          hint:
            error.hint ||
            null
        });

      }


      console.log(
        "✅✅✅ REQUEST SAVED SUCCESSFULLY ✅✅✅"
      );


      console.log(
        "SAVED REQUEST:",
        JSON.stringify(data)
      );


      return res.status(201).json({
        success: true,
        message:
          "Request successfully created",
        request:
          data
      });


    } catch (error) {

      console.error(
        "❌❌❌ REQUEST SERVER ERROR ❌❌❌"
      );

      console.error(error);


      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Request save nahi hui",
        actualError:
          error.message ||
          "Unknown server error"
      });

    }

  }
);


// =====================================
// DISTANCE CALCULATOR
// =====================================

function calculateDistanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const earthRadiusKm =
    6371;


  const dLat =
    (lat2 - lat1) *
    Math.PI /
    180;

  const dLon =
    (lon2 - lon1) *
    Math.PI /
    180;


  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +

    Math.cos(
      lat1 * Math.PI / 180
    ) *
    Math.cos(
      lat2 * Math.PI / 180
    ) *

    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );


  return earthRadiusKm * c;

}


// =====================================
// GET NEARBY REQUESTS FOR KARIGAR
// =====================================

app.get(
  "/api/requests/nearby",
  async (req, res) => {

    try {

      const lat =
        Number(req.query.latitude);

      const lng =
        Number(req.query.longitude);

      const service =
        String(
          req.query.service || ""
        ).trim();

      const radius =
        Number(
          req.query.radius || 50
        );


      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Karigar latitude aur longitude required hain"
        });

      }


      const {
        data,
        error
      } =
        await supabase
          .from("service_requests")
          .select("*")
          .order("id", {
            ascending: false
          });


      if (error) {

        console.error(
          "❌ NEARBY REQUESTS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            error.message,
          actualError:
            error.message
        });

      }


      const nearbyRequests =
        data
          .filter(request => {

            // Only active requests
            const status =
              String(
                request.status ||
                "New"
              );

            if (
              status === "Completed" ||
              status === "Cancelled"
            ) {

              return false;

            }


            // Service match
            if (
              service &&
              String(
                request.service || ""
              ).toLowerCase() !==
              service.toLowerCase()
            ) {

              return false;

            }


            // GPS missing
            if (
              request.latitude === null ||
              request.latitude === undefined ||
              request.longitude === null ||
              request.longitude === undefined
            ) {

              return false;

            }


            const distance =
              calculateDistanceKm(
                lat,
                lng,
                Number(request.latitude),
                Number(request.longitude)
              );


            request.distance_km =
              Number(
                distance.toFixed(2)
              );


            return distance <= radius;

          })
          .sort(
            (a, b) =>
              a.distance_km -
              b.distance_km
          );


      return res.json({

        success: true,

        count:
          nearbyRequests.length,

        radius_km:
          radius,

        requests:
          nearbyRequests

      });


    } catch (error) {

      console.error(
        "❌ NEARBY REQUESTS SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Nearby requests load nahi hui",
        actualError:
          error.message
      });

    }

  }
);


// =====================================
// GET ALL REQUESTS
// =====================================

app.get(
  "/api/requests",
  async (req, res) => {

    try {

      const {
        data,
        error
      } =
        await supabase
          .from("service_requests")
          .select("*")
          .order("id", {
            ascending: false
          });


      if (error) {

        console.error(
          "❌ GET REQUESTS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            error.message,
          actualError:
            error.message,
          code:
            error.code,
          details:
            error.details,
          hint:
            error.hint
        });

      }


      return res.json({
        success: true,
        count:
          data.length,
        requests:
          data
      });


    } catch (error) {

      console.error(
        "❌ GET REQUESTS SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
        actualError:
          error.message
      });

    }

  }
);


// =====================================
// GET CUSTOMER REQUESTS BY PHONE
// =====================================

app.get(
  "/api/customer-requests",
  async (req, res) => {

    try {

      const phone =
        String(
          req.query.phone || ""
        ).trim();


      if (!phone) {

        return res.status(400).json({
          success: false,
          message:
            "Phone number required"
        });

      }


      const {
        data,
        error
      } =
        await supabase
          .from("service_requests")
          .select("*")
          .eq("phone", phone)
          .order("id", {
            ascending: false
          });


      if (error) {

        console.error(
          "❌ CUSTOMER REQUESTS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            error.message,
          actualError:
            error.message,
          code:
            error.code,
          details:
            error.details,
          hint:
            error.hint
        });

      }


      return res.json({
        success: true,
        count:
          data.length,
        requests:
          data
      });


    } catch (error) {

      console.error(
        "❌ CUSTOMER REQUESTS SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Customer requests load nahi hui",
        actualError:
          error.message ||
          "Unknown server error"
      });

    }

  }
);


// =====================================
// GET SINGLE REQUEST
// =====================================

app.get(
  "/api/requests/:id",
  async (req, res) => {

    try {

      const id =
        req.params.id;


      const {
        data,
        error
      } =
        await supabase
          .from("service_requests")
          .select("*")
          .eq("id", id)
          .single();


      if (error) {

        console.error(
          "❌ GET SINGLE REQUEST ERROR:",
          error
        );

        return res.status(404).json({
          success: false,
          message:
            "Request nahi mili",
          actualError:
            error.message,
          code:
            error.code,
          details:
            error.details,
          hint:
            error.hint
        });

      }


      return res.json({
        success: true,
        request:
          data
      });


    } catch (error) {

      console.error(
        "❌ GET SINGLE REQUEST SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
        actualError:
          error.message
      });

    }

  }
);


// =====================================
// UPDATE REQUEST STATUS
// =====================================

app.patch(
  "/api/requests/:id/status",
  async (req, res) => {

    try {

      const id =
        req.params.id;

      const {
        status
      } = req.body;


      const allowedStatuses = [
        "New",
        "Accepted",
        "In Progress",
        "Assigned",
        "Completed",
        "Cancelled"
      ];


      if (
        !allowedStatuses.includes(status)
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Invalid status"
        });

      }


      const {
        data,
        error
      } =
        await supabase
          .from("service_requests")
          .update({
            status:
              status
          })
          .eq("id", id)
          .select()
          .single();


      if (error) {

        console.error(
          "❌ UPDATE STATUS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            error.message,
          actualError:
            error.message,
          code:
            error.code,
          details:
            error.details,
          hint:
            error.hint
        });

      }


      return res.json({
        success: true,
        message:
          "Status updated",
        request:
          data
      });


    } catch (error) {

      console.error(
        "❌ UPDATE STATUS SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
        actualError:
          error.message
      });

    }

  }
);


// =====================================
// UNKNOWN API ROUTE
// =====================================

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({
      success: false,
      error:
        "API route not found"
    });

  }
);


// =====================================
// SERVER START
// =====================================

app.listen(
  PORT,
  () => {

    console.log(
      `🚀 Hey Karigar server running on port ${PORT}`
    );

  }
);
