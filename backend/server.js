const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase environment variables missing");
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* =====================================================
   FRONTEND
===================================================== */

app.use(express.static(path.join(__dirname, "..")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

/* =====================================================
   API HEALTH
===================================================== */

app.get("/api", (req, res) => {
  res.json({
    app: "Hey Karigar API",
    status: "running",
    version: "4.0.0"
  });
});

/* =====================================================
   PHONE HELPER
===================================================== */

function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 10) {
    digits = "91" + digits;
  }

  return digits;
}

function internalAuthEmail(phone) {
  const normalized = normalizePhone(phone);
  return `${normalized}@login.heykarigar.app`;
}

/* =====================================================
   AUTHENTICATE
===================================================== */

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Login required"
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token missing"
      });
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again."
      });
    }

    const {
      data: profile,
      error: profileError
    } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({
        success: false,
        message: "Profile nahi mili"
      });
    }

    req.user = user;
    req.profile = profile;

    next();

  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(401).json({
      success: false,
      message: "Authentication failed"
    });
  }
}

/* =====================================================
   ADMIN ONLY
===================================================== */

function adminOnly(req, res, next) {

  if (!req.profile || req.profile.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Sirf Admin access kar sakta hai"
    });
  }

  next();
}

/* =====================================================
   SIGNUP
===================================================== */

app.post("/api/auth/signup", async (req, res) => {
  try {

    const {
      name,
      full_name,
      phone,
      email,
      password,
      role,
      service,
      location,
      state,
      latitude,
      longitude
    } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile number aur password zaroori hain"
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password kam se kam 6 characters ka hona chahiye"
      });
    }

    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Sahi mobile number enter karein"
      });
    }

    /*
      Public signup se sirf Customer ya Karigar ban sakta hai.
      Admin manually database se banega.
    */

    const selectedRole =
      role === "karigar" ? "karigar" : "customer";

    const { data: existingProfile } =
      await supabase
        .from("profiles")
        .select("id, phone")
        .eq("phone", normalizedPhone)
        .maybeSingle();

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: "Ye mobile number pehle se registered hai. Login karein."
      });
    }

    const authEmail = internalAuthEmail(normalizedPhone);

    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email: authEmail,
        password: String(password),
        email_confirm: true
      });

    if (userError) {
      console.error("Auth signup error:", userError);

      return res.status(400).json({
        success: false,
        message: userError.message || "Signup failed"
      });
    }

    const userId = userData.user.id;

    const realEmail =
      email && String(email).trim()
        ? String(email).trim().toLowerCase()
        : null;

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .insert([
          {
            id: userId,
            name: name || full_name || "",
            full_name: full_name || name || "",
            phone: normalizedPhone,
            email: realEmail,
            role: selectedRole,
            service: service || null,
            location: location || null,
            state: state || null,
            latitude: latitude || null,
            longitude: longitude || null
          }
        ])
        .select()
        .single();

    if (profileError) {

      await supabase.auth.admin.deleteUser(userId);

      return res.status(400).json({
        success: false,
        message: profileError.message || "Profile create nahi hua"
      });
    }

    return res.json({
      success: true,
      message: "Account successfully create ho gaya",
      profile
    });

  } catch (error) {

    console.error("Signup error:", error);

    return res.status(500).json({
      success: false,
      message: "Signup failed"
    });
  }
});

/* =====================================================
   LOGIN
   Mobile OR Email supported
===================================================== */

app.post("/api/auth/login", async (req, res) => {
  try {

    const loginValue =
      String(
        req.body.phone ||
        req.body.email ||
        ""
      ).trim();

    const password =
      String(req.body.password || "");

    if (!loginValue || !password) {
      return res.status(400).json({
        success: false,
        message: "Mobile number/email aur password zaroori hain"
      });
    }

    let authEmail = "";
    let profile = null;

    /*
      Agar email diya gaya hai:
      direct email se login.
    */

    if (loginValue.includes("@")) {

      const { data: profileByEmail } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("email", loginValue.toLowerCase())
          .maybeSingle();

      if (profileByEmail) {
        profile = profileByEmail;
      }

      authEmail = loginValue.toLowerCase();

    } else {

      /*
        Mobile se profile find karo.
      */

      const normalizedPhone =
        normalizePhone(loginValue);

      const { data: profileByPhone } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("phone", normalizedPhone)
          .maybeSingle();

      if (!profileByPhone) {
        return res.status(401).json({
          success: false,
          message: "Mobile number ya password galat hai"
        });
      }

      profile = profileByPhone;

      /*
        Existing Auth user ka actual email nikaalo.
        Isse manually-created Admin user bhi login kar sakega.
      */

      const {
        data: authUserData,
        error: authUserError
      } =
        await supabase.auth.admin.getUserById(
          profile.id
        );

      if (authUserError || !authUserData.user) {
        return res.status(401).json({
          success: false,
          message: "Login account nahi mila"
        });
      }

      authEmail =
        authUserData.user.email;

    }

    if (!authEmail) {
      return res.status(401).json({
        success: false,
        message: "Login account nahi mila"
      });
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: authEmail,
        password: password
      });

    if (error) {

      console.error("Login error:", error);

      return res.status(401).json({
        success: false,
        message: "Mobile number/email ya password galat hai"
      });
    }

    const user = data.user;

    /*
      Profile dobara user ID se load karte hain.
    */

    const { data: finalProfile, error: finalProfileError } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (finalProfileError || !finalProfile) {
      return res.status(404).json({
        success: false,
        message: "Profile nahi mili"
      });
    }

    return res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id
      },
      profile: finalProfile,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });

  } catch (error) {

    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

/* =====================================================
   PROFILE
===================================================== */

app.get("/api/profile/:id", authenticate, async (req, res) => {

  if (req.params.id !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Aap sirf apni profile dekh sakte hain"
    });
  }

  return res.json({
    success: true,
    profile: req.profile
  });
});

/* =====================================================
   UPDATE LOCATION
===================================================== */

app.put("/api/profile/:id/location", authenticate, async (req, res) => {
  try {

    if (req.params.id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Aap sirf apni location update kar sakte hain"
      });
    }

    const {
      latitude,
      longitude,
      location,
      state
    } = req.body;

    const { data, error } =
      await supabase
        .from("profiles")
        .update({
          latitude: latitude || null,
          longitude: longitude || null,
          location: location || null,
          state: state || null,
          location_updated_at:
            new Date().toISOString()
        })
        .eq("id", req.user.id)
        .select()
        .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.json({
      success: true,
      profile: data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Location update nahi hui"
    });
  }
});

/* =====================================================
   CREATE REQUEST
===================================================== */

app.post("/api/requests", authenticate, async (req, res) => {
  try {

    if (req.profile.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Sirf customer request create kar sakta hai"
      });
    }

    const {
      customer_name,
      phone,
      service,
      address,
      description
    } = req.body;

    if (!customer_name || !phone || !service || !address) {
      return res.status(400).json({
        success: false,
        message:
          "Name, mobile, service aur address zaroori hain"
      });
    }

    const { data, error } =
      await supabase
        .from("service_requests")
        .insert([
          {
            customer_name,
            phone,
            service,
            address,
            description: description || null,
            customer_id: req.user.id,
            status: "New",
            karigar_id: null
          }
        ])
        .select()
        .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.json({
      success: true,
      message: "Service request successfully create ho gayi",
      request: data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Request create nahi hui"
    });
  }
});

/* =====================================================
   KARIGAR REQUESTS
===================================================== */

app.get("/api/requests", authenticate, async (req, res) => {
  try {

    if (req.profile.role !== "karigar") {
      return res.status(403).json({
        success: false,
        message: "Sirf Karigar requests dekh sakta hai"
      });
    }

    const { data, error } =
      await supabase
        .from("service_requests")
        .select("*")
        .or(
          `status.eq.New,karigar_id.eq.${req.user.id}`
        )
        .order("id", { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      requests: data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Requests load nahi hui"
    });
  }
});

/* =====================================================
   CUSTOMER REQUESTS
===================================================== */

app.get(
  "/api/customer/requests/:customerId",
  authenticate,
  async (req, res) => {

    try {

      if (req.profile.role !== "customer") {
        return res.status(403).json({
          success: false,
          message: "Sirf customer apni requests dekh sakta hai"
        });
      }

      if (req.params.customerId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Aap sirf apni requests dekh sakte hain"
        });
      }

      const { data, error } =
        await supabase
          .from("service_requests")
          .select("*")
          .eq("customer_id", req.user.id)
          .order("id", { ascending: false });

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      return res.json({
        success: true,
        requests: data
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message: "Customer requests load nahi hui"
      });
    }
  }
);

/* =====================================================
   SINGLE REQUEST
===================================================== */

app.get("/api/requests/:id", async (req, res) => {

  try {

    const { data, error } =
      await supabase
        .from("service_requests")
        .select("*")
        .eq("id", req.params.id)
        .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: "Request nahi mili"
      });
    }

    return res.json({
      success: true,
      request: data
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Request load nahi hui"
    });
  }
});

/* =====================================================
   UPDATE STATUS
===================================================== */

app.put(
  "/api/requests/:id/status",
  authenticate,
  async (req, res) => {

    try {

      if (req.profile.role !== "karigar") {
        return res.status(403).json({
          success: false,
          message:
            "Sirf Karigar status update kar sakta hai"
        });
      }

      const requestedStatus =
        req.body.status;

      const allowedStatuses = [
        "Accepted",
        "On The Way",
        "Working",
        "Completed"
      ];

      if (!allowedStatuses.includes(requestedStatus)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Cancel allowed nahi hai."
        });
      }

      const { data: request, error: requestError } =
        await supabase
          .from("service_requests")
          .select("*")
          .eq("id", req.params.id)
          .single();

      if (requestError || !request) {
        return res.status(404).json({
          success: false,
          message: "Request nahi mili"
        });
      }

      if (requestedStatus === "Accepted") {

        if (request.status !== "New") {
          return res.status(400).json({
            success: false,
            message:
              "Ye request ab available nahi hai"
          });
        }

        if (request.karigar_id) {
          return res.status(400).json({
            success: false,
            message:
              "Ye request kisi Karigar ko already assign hai"
          });
        }

        const { data, error } =
          await supabase
            .from("service_requests")
            .update({
              status: "Accepted",
              karigar_id: req.user.id
            })
            .eq("id", request.id)
            .eq("status", "New")
            .is("karigar_id", null)
            .select()
            .single();

        if (error || !data) {
          return res.status(409).json({
            success: false,
            message:
              "Request kisi aur Karigar ne accept kar li ho sakti hai"
          });
        }

        return res.json({
          success: true,
          message: "Request accept ho gayi",
          request: data
        });
      }

      if (request.karigar_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message:
            "Ye request aapko assigned nahi hai"
        });
      }

      const nextStatus = {
        "Accepted": "On The Way",
        "On The Way": "Working",
        "Working": "Completed"
      };

      if (
        nextStatus[request.status] !==
        requestedStatus
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Status order galat hai. ${request.status} ke baad ${nextStatus[request.status] || "koi status"} hona chahiye.`
        });
      }

      const { data, error } =
        await supabase
          .from("service_requests")
          .update({
            status: requestedStatus
          })
          .eq("id", request.id)
          .eq("karigar_id", req.user.id)
          .eq("status", request.status)
          .select()
          .single();

      if (error || !data) {
        return res.status(400).json({
          success: false,
          message: "Status update nahi hua"
        });
      }

      return res.json({
        success: true,
        message: "Status update ho gaya",
        request: data
      });

    } catch (error) {

      return res.status(500).json({
        success: false,
        message: "Status update nahi hua"
      });
    }
  }
);

/* =====================================================
   ADMIN DASHBOARD
===================================================== */

app.get(
  "/api/admin/dashboard",
  authenticate,
  adminOnly,
  async (req, res) => {

    try {

      const {
        data: profiles,
        error: profilesError
      } =
        await supabase
          .from("profiles")
          .select("*")
          .order("created_at", {
            ascending: false
          });

      if (profilesError) {
        return res.status(400).json({
          success: false,
          message: profilesError.message
        });
      }

      const {
        data: requests,
        error: requestsError
      } =
        await supabase
          .from("service_requests")
          .select("*")
          .order("id", {
            ascending: false
          });

      if (requestsError) {
        return res.status(400).json({
          success: false,
          message: requestsError.message
        });
      }

      const customers =
        profiles.filter(
          p => p.role === "customer"
        );

      const karigars =
        profiles.filter(
          p => p.role === "karigar"
        );

      return res.json({
        success: true,

        stats: {
          totalUsers: profiles.length,
          customers: customers.length,
          karigars: karigars.length,
          totalRequests: requests.length,
          newRequests:
            requests.filter(
              r => r.status === "New"
            ).length,
          completedRequests:
            requests.filter(
              r => r.status === "Completed"
            ).length
        },

        profiles,
        requests
      });

    } catch (error) {

      console.error(
        "Admin dashboard error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Admin dashboard load nahi hua"
      });
    }
  }
);

/* =====================================================
   UNKNOWN API
===================================================== */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

/* =====================================================
   START
===================================================== */

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `🚀 Hey Karigar server running on port ${PORT}`
  );
});
