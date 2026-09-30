const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Supabase environment variables missing");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// Frontend
const FRONTEND_PATH = path.join(__dirname, "..");

app.use(express.static(FRONTEND_PATH));


// =========================
// HOME
// =========================
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});


// =========================
// API HEALTH
// =========================
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Hey Karigar API healthy"
  });
});

app.get("/api", (req, res) => {
  res.json({
    app: "Hey Karigar API",
    status: "running",
    version: "1.0.0"
  });
});


// =========================
// SIGNUP
// =========================
app.post("/api/auth/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      service
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password aur role zaroori hain"
      });
    }

    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password,
        email_confirm: true
      });

    if (userError) {
      console.error("SIGNUP AUTH ERROR:", userError);

      return res.status(400).json({
        success: false,
        message: userError.message
      });
    }

    const userId = userData.user.id;

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .insert({
          id: userId,
          name: String(name).trim(),
          email: String(email).trim().toLowerCase(),
          phone: phone ? String(phone).trim() : null,
          role: String(role).trim(),
          service: service ? String(service).trim() : null
        })
        .select()
        .single();

    if (profileError) {
      console.error("SIGNUP PROFILE ERROR:", profileError);

      return res.status(400).json({
        success: false,
        message: profileError.message
      });
    }

    res.json({
      success: true,
      message: "Signup successful",
      profile
    });

  } catch (error) {
    console.error("SIGNUP ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Signup failed"
    });
  }
});


// =========================
// LOGIN
// =========================
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email aur password zaroori hain"
      });
    }

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: String(email).trim().toLowerCase(),
        password
      });

    if (error) {
      console.error("LOGIN ERROR:", error);

      return res.status(401).json({
        success: false,
        message: "Email ya password galat hai"
      });
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

    if (profileError) {
      console.error("LOGIN PROFILE ERROR:", profileError);

      return res.status(400).json({
        success: false,
        message: "Profile nahi mili"
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      session: data.session,
      profile
    });

  } catch (error) {
    console.error("LOGIN SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Login failed"
    });
  }
});


// =========================
// PROFILE
// =========================
app.get("/api/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
      console.error("PROFILE ERROR:", error);

      return res.status(404).json({
        success: false,
        message: "Profile nahi mili"
      });
    }

    res.json({
      success: true,
      profile: data
    });

  } catch (error) {
    console.error("PROFILE SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// =========================
// CREATE SERVICE REQUEST
// =========================
app.post("/api/requests", async (req, res) => {
  try {
    console.log("📥 NEW REQUEST BODY:", req.body);

    const {
      name,
      phone,
      location,
      service,
      details
    } = req.body;

    if (!name || !phone || !location || !service) {
      console.error("❌ REQUEST VALIDATION FAILED");

      return res.status(400).json({
        success: false,
        message: "Name, phone, location aur service zaroori hain"
      });
    }

    const requestData = {
      name: String(name).trim(),
      phone: String(phone).trim(),
      location: String(location).trim(),
      service: String(service).trim(),
      details: details ? String(details).trim() : "",
      status: "New"
    };

    console.log("📤 SAVING REQUEST:", requestData);

    const {
      data,
      error
    } = await supabase
      .from("service_requests")
      .insert([requestData])
      .select()
      .single();

    if (error) {
      console.error("❌ SUPABASE REQUEST INSERT ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Request save nahi hui",
        actualError: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    }

    console.log("✅ REQUEST SAVED:", data);

    res.status(201).json({
      success: true,
      message: "Request successfully created",
      request: data
    });

  } catch (error) {
    console.error("❌ REQUEST SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Request save nahi hui",
      actualError: error.message
    });
  }
});


// =========================
// GET ALL REQUESTS
// =========================
app.get("/api/requests", async (req, res) => {
  try {
    const {
      data,
      error
    } = await supabase
      .from("service_requests")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("GET REQUESTS ERROR:", error);

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      count: data.length,
      requests: data
    });

  } catch (error) {
    console.error("GET REQUESTS SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// =========================
// GET SINGLE REQUEST
// =========================
app.get("/api/requests/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const {
      data,
      error
    } = await supabase
      .from("service_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("GET SINGLE REQUEST ERROR:", error);

      return res.status(404).json({
        success: false,
        message: "Request nahi mili",
        actualError: error.message
      });
    }

    res.json({
      success: true,
      request: data
    });

  } catch (error) {
    console.error("GET SINGLE REQUEST SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// =========================
// UPDATE REQUEST STATUS
// =========================
app.patch("/api/requests/:id/status", async (req, res) => {
  try {
    const id = req.params.id;
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

    const {
      data,
      error
    } = await supabase
      .from("service_requests")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("UPDATE STATUS ERROR:", error);

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }

    res.json({
      success: true,
      message: "Status updated",
      request: data
    });

  } catch (error) {
    console.error("UPDATE STATUS SERVER ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// =========================
// 404 API
// =========================
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API route not found"
  });
});


// =========================
// SERVER
// =========================
app.listen(PORT, () => {
  console.log(`🚀 Hey Karigar server running on port ${PORT}`);
});
