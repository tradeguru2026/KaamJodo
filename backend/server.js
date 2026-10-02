const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());


// =====================================
// SUPABASE
// =====================================

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

app.use(express.static(path.join(__dirname, "..")));


// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "..", "index.html")
  );
});


// =====================================
// API HEALTH
// =====================================

app.get("/api", (req, res) => {
  res.json({
    app: "Hey Karigar API",
    status: "running",
    version: "1.2.0"
  });
});


// =====================================
// SIGNUP
// =====================================

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

    if (
      !email ||
      !password ||
      !phone
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Email, mobile aur password zaroori hain"
      });

    }

    if (String(password).length < 6) {

      return res.status(400).json({
        success: false,
        message:
          "Password kam se kam 6 characters ka hona chahiye"
      });

    }


    // Create Supabase Auth user

    const {
      data: userData,
      error: userError
    } =
      await supabase.auth.admin.createUser({
        email:
          String(email)
            .trim()
            .toLowerCase(),

        password:
          String(password),

        email_confirm: true
      });


    if (userError) {

      console.error(
        "❌ SIGNUP AUTH ERROR:",
        userError
      );

      return res.status(400).json({
        success: false,
        message:
          userError.message ||
          "Signup failed"
      });

    }


    const userId =
      userData.user.id;


    // Insert profile

    const {
      data: profile,
      error: profileError
    } =
      await supabase
        .from("profiles")
        .insert([
          {
            id: userId,

            name:
              name ||
              full_name ||
              "",

            full_name:
              full_name ||
              name ||
              "",

            phone:
              String(phone),

            email:
              String(email)
                .trim()
                .toLowerCase(),

            role:
              role ||
              "customer",

            service:
              service ||
              null,

            location:
              location ||
              null,

            state:
              state ||
              null,

            latitude:
              latitude ||
              null,

            longitude:
              longitude ||
              null
          }
        ])
        .select()
        .single();


    if (profileError) {

      console.error(
        "❌ PROFILE INSERT ERROR:",
        profileError
      );

      return res.status(400).json({
        success: false,
        message:
          profileError.message ||
          "Profile create nahi hua"
      });

    }


    return res.json({
      success: true,
      message:
        "Account successfully create ho gaya",
      profile
    });


  } catch (error) {

    console.error(
      "❌ SIGNUP SERVER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Signup failed"
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


    const {
      data,
      error
    } =
      await supabase.auth.signInWithPassword({
        email:
          String(email)
            .trim()
            .toLowerCase(),

        password:
          String(password)
      });


    if (error) {

      console.error(
        "❌ LOGIN ERROR:",
        error
      );

      return res.status(401).json({
        success: false,
        message:
          "Email ya password galat hai"
      });

    }


    const user =
      data.user;


    // Get profile

    const {
      data: profile,
      error: profileError
    } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();


    if (profileError) {

      console.error(
        "❌ PROFILE LOGIN ERROR:",
        profileError
      );

      return res.status(404).json({
        success: false,
        message:
          "Profile nahi mili"
      });

    }


    return res.json({

      success: true,

      message:
        "Login successful",

      user: {
        id:
          user.id,

        email:
          user.email
      },

      profile,

      access_token:
        data.session.access_token,

      refresh_token:
        data.session.refresh_token

    });


  } catch (error) {

    console.error(
      "❌ LOGIN SERVER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Login failed"
    });

  }

});


// =====================================
// FORGOT PASSWORD
// =====================================

const RESET_REDIRECT_URL =
  "https://hey-karigar-2026.onrender.com/";


app.post(
  "/api/auth/forgot-password",
  async (req, res) => {

    try {

      const email =
        String(req.body.email || "")
          .trim()
          .toLowerCase();


      if (!email) {

        return res.status(400).json({
          success: false,
          message:
            "Email zaroori hai"
        });

      }


      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo:
              RESET_REDIRECT_URL
          }
        );


      if (error) {

        console.error(
          "❌ FORGOT PASSWORD ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            "Password reset email bhejne mein problem hui"
        });

      }


      return res.json({
        success: true,
        message:
          "Agar yeh email registered hai to password reset link bhej diya gaya hai."
      });


    } catch (error) {

      console.error(
        "❌ FORGOT PASSWORD SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Password reset request failed"
      });

    }

  }
);


// =====================================
// RESET PASSWORD
// =====================================

app.post(
  "/api/auth/reset-password",
  async (req, res) => {

    try {

      const {
        access_token,
        password
      } = req.body;


      if (
        !access_token ||
        !password
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Reset token aur new password zaroori hain"
        });

      }


      if (
        String(password).length < 6
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Password kam se kam 6 characters ka hona chahiye"
        });

      }


      // Verify recovery token

      const {
        data: userData,
        error: userError
      } =
        await supabase.auth.getUser(
          access_token
        );


      if (
        userError ||
        !userData ||
        !userData.user
      ) {

        console.error(
          "❌ RESET TOKEN ERROR:",
          userError
        );

        return res.status(401).json({
          success: false,
          message:
            "Reset link invalid ya expire ho gaya hai"
        });

      }


      // Change password

      const {
        error: updateError
      } =
        await supabase.auth.admin.updateUserById(
          userData.user.id,
          {
            password:
              String(password)
          }
        );


      if (updateError) {

        console.error(
          "❌ PASSWORD UPDATE ERROR:",
          updateError
        );

        return res.status(400).json({
          success: false,
          message:
            updateError.message ||
            "Password update nahi hua"
        });

      }


      return res.json({
        success: true,
        message:
          "Password successfully change ho gaya"
      });


    } catch (error) {

      console.error(
        "❌ RESET PASSWORD SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Password reset failed"
      });

    }

  }
);


// =====================================
// GET PROFILE
// =====================================

app.get(
  "/api/profile/:id",
  async (req, res) => {

    try {

      const {
        data,
        error
      } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", req.params.id)
          .single();


      if (error) {

        return res.status(404).json({
          success: false,
          message:
            "Profile nahi mili"
        });

      }


      return res.json({
        success: true,
        profile: data
      });


    } catch (error) {

      console.error(
        "❌ GET PROFILE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Profile load failed"
      });

    }

  }
);


// =====================================
// UPDATE LOCATION
// =====================================

app.put(
  "/api/profile/:id/location",
  async (req, res) => {

    try {

      const {
        latitude,
        longitude,
        location
      } = req.body;


      const {
        data,
        error
      } =
        await supabase
          .from("profiles")
          .update({
            latitude:
              latitude ||
              null,

            longitude:
              longitude ||
              null,

            location:
              location ||
              null
          })
          .eq("id", req.params.id)
          .select()
          .single();


      if (error) {

        console.error(
          "❌ LOCATION UPDATE ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            error.message
        });

      }


      return res.json({
        success: true,
        profile: data
      });


    } catch (error) {

      console.error(
        "❌ LOCATION SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Location update failed"
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

      const {
        customer_name,
        phone,
        service,
        address,
        description,
        customer_id
      } = req.body;


      const {
        data,
        error
      } =
        await supabase
          .from("service_requests")
          .insert([
            {
              customer_name:
                customer_name ||
                "",

              phone:
                phone ||
                "",

              service:
                service ||
                "",

              address:
                address ||
                "",

              description:
                description ||
                "",

              customer_id:
                customer_id ||
                null,

              status:
                "New"
            }
          ])
          .select()
          .single();


      if (error) {

        console.error(
          "❌ REQUEST CREATE ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            error.message
        });

      }


      return res.json({
        success: true,
        request: data
      });


    } catch (error) {

      console.error(
        "❌ REQUEST SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Request create failed"
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
          .order(
            "id",
            {
              ascending: false
            }
          );


      if (error) {

        console.error(
          "❌ REQUEST LOAD ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            error.message
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
        "❌ REQUEST SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load service requests"
      });

    }

  }
);


// =====================================
// CUSTOMER REQUESTS
// =====================================

app.get(
  "/api/customer/requests/:customerId",
  async (req, res) => {

    try {

      const {
        data,
        error
      } =
        await supabase
          .from("service_requests")
          .select("*")
          .eq(
            "customer_id",
            req.params.customerId
          )
          .order(
            "id",
            {
              ascending: false
            }
          );


      if (error) {

        console.error(
          "❌ CUSTOMER REQUEST ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            error.message
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
        "❌ CUSTOMER REQUEST SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Customer requests load failed"
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

      const {
        data,
        error
      } =
        await supabase
          .from("service_requests")
          .select("*")
          .eq(
            "id",
            req.params.id
          )
          .single();


      if (error) {

        return res.status(404).json({
          success: false,
          message:
            "Request nahi mili"
        });

      }


      return res.json({
        success: true,
        request: data
      });


    } catch (error) {

      console.error(
        "❌ SINGLE REQUEST ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Request load failed"
      });

    }

  }
);


// =====================================
// UPDATE REQUEST STATUS
// =====================================

app.put(
  "/api/requests/:id/status",
  async (req, res) => {

    try {

      const {
        status
      } = req.body;


      if (!status) {

        return res.status(400).json({
          success: false,
          message:
            "Status zaroori hai"
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
          .eq(
            "id",
            req.params.id
          )
          .select()
          .single();


      if (error) {

        console.error(
          "❌ STATUS UPDATE ERROR:",
          error
        );

        return res.status(400).json({
          success: false,
          message:
            error.message
        });

      }


      return res.json({
        success: true,
        request: data
      });


    } catch (error) {

      console.error(
        "❌ STATUS SERVER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Status update failed"
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
      message:
        "API route not found"
    });

  }
);


// =====================================
// START SERVER
// =====================================

const PORT =
  process.env.PORT || 5000;


app.listen(
  PORT,
  () => {

    console.log(
      `🚀 Hey Karigar server running on port ${PORT}`
    );

  }
);
