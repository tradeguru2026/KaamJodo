const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 5000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Supabase environment variables are missing");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "karigar.html"));
});

app.get("/api", (req, res) => {
  res.json({
    app: "Hey Karigar API",
    status: "running",
    version: "1.0.0"
  });
});

/* =========================
   AUTH - SIGNUP
========================= */

app.post("/api/auth/signup", async (req, res) => {
  try {
    const {
      full_name,
      phone,
      email,
      password,
      role,
      service,
      location
    } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password aur role zaroori hain"
      });
    }

    if (!["customer", "karigar"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password kam se kam 6 characters ka hona chahiye"
      });
    }

    if (role === "karigar" && !service) {
      return res.status(400).json({
        success: false,
        message: "Karigar ke liye service zaroori hai"
      });
    }

    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          phone: phone || "",
          role,
          service: service || "",
          location: location || ""
        }
      });

    if (userError) {
      return res.status(400).json({
        success: false,
        message: userError.message
      });
    }

    const user = userData.user;

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name,
        phone: phone || null,
        role,
        service: service || null,
        location: location || null
      });

    if (profileError) {
      console.error("Profile error:", profileError);

      await supabase.auth.admin.deleteUser(user.id);

      return res.status(500).json({
        success: false,
        message: "Profile create nahi ho saka"
      });
    }

    return res.status(201).json({
      success: true,
      message:
        role === "karigar"
          ? "Karigar account successfully create ho gaya"
          : "Customer account successfully create ho gaya",
      user: {
        id: user.id,
        email: user.email,
        full_name,
        phone,
        role,
        service,
        location
      }
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      success: false,
      message: "Signup failed"
    });
  }
});

/* =========================
   AUTH - LOGIN
========================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email aur password zaroori hain"
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) {
      return res.status(401).json({
        success: false,
        message: "Email ya password galat hai"
      });
    }

    const user = data.user;
    const session = data.session;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return res.status(500).json({
        success: false,
        message: "Profile load nahi ho saka"
      });
    }

    return res.json({
      success: true,
      message: "Login successful",
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at
      },
      user: {
        id: user.id,
        email: user.email
      },
      profile
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

/* =========================
   GET PROFILE
========================= */

app.get("/api/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: "Profile nahi mila"
      });
    }

    res.json({
      success: true,
      profile: data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Profile load failed"
    });
  }
});

/* =========================
   SERVICE REQUESTS
========================= */

/* Create request */

app.post("/api/requests", async (req, res) => {
  try {
    const {
      name,
      phone,
      location,
      service,
      details
    } = req.body;

    if (!name || !phone || !location || !service) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, location aur service zaroori hain"
      });
    }

    const { data, error } = await supabase
      .from("service_requests")
      .insert({
        name,
        phone,
        location,
        service,
        details: details || "",
        status: "New"
      })
      .select()
      .single();

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Request save nahi hui"
      });
    }

    res.status(201).json({
      success: true,
      request: data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* Get all requests */

app.get("/api/requests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("service_requests")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Could not load service requests"
      });
    }

    res.json({
      success: true,
      count: data.length,
      requests: data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* Get single request */

app.get("/api/requests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("service_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: "Request nahi mili"
      });
    }

    res.json({
      success: true,
      request: data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* Update request status */

app.patch("/api/requests/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "New",
      "Accepted",
      "In Progress",
      "Assigned",
      "Completed",
      "Cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const { data, error } = await supabase
      .from("service_requests")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Status update nahi hua"
      });
    }

    res.json({
      success: true,
      request: data
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Hey Karigar server is healthy"
  });
});

/* =========================
   UNKNOWN API ROUTE
========================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API route not found"
  });
});

/* =========================
   SERVER
========================= */

app.listen(PORT, () => {
  console.log(`Hey Karigar server running on port ${PORT}`);
});
