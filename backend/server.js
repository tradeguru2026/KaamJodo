const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===============================
// SUPABASE
// ===============================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseRequest(endpoint, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase environment variables are missing.");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": options.method === "POST"
          ? "return=representation"
          : "return=representation",
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      typeof data === "string"
        ? data
        : JSON.stringify(data)
    );
  }

  return data;
}

// ===============================
// FRONTEND
// ===============================

app.use(express.static(path.join(__dirname, "..")));

// ===============================
// HEY KARIGAR DATA
// ===============================

const categories = [
  { id: 1, name: "Gardener / Mali", icon: "🌱" },
  { id: 2, name: "Plumber", icon: "🚰" },
  { id: 3, name: "Electrician", icon: "💡" },
  { id: 4, name: "Carpenter", icon: "🔨" },
  { id: 5, name: "Painter", icon: "🎨" },
  { id: 6, name: "AC Repair", icon: "❄️" },
  { id: 7, name: "Washing Machine Repair", icon: "🧺" },
  { id: 8, name: "TV Repair", icon: "📺" },
  { id: 9, name: "Gutter Cleaning", icon: "🧹" },
  { id: 10, name: "Home Cleaning", icon: "🧼" },
  { id: 11, name: "Carpet Cleaning", icon: "🧽" },
  { id: 12, name: "Generator Mechanic", icon: "🔧" },
  { id: 13, name: "Puncture / Tyre Replacement", icon: "🛞" },
  { id: 14, name: "Barber", icon: "💈" },
  { id: 15, name: "Physiotherapist", icon: "🧑‍⚕️" },
  { id: 16, name: "Mehndi Artist", icon: "🌿" }
];

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

// ===============================
// API INFO
// ===============================

app.get("/api", (req, res) => {
  res.json({
    success: true,
    app: "Hey Karigar",
    message: "API is working",
    database: SUPABASE_URL ? "Supabase connected" : "Supabase not configured",
    endpoints: [
      "/api/categories",
      "/api/requests",
      "/api/requests/:id",
      "/api/requests/:id/status"
    ]
  });
});

// ===============================
// CATEGORIES
// ===============================

app.get("/api/categories", (req, res) => {
  res.json({
    success: true,
    count: categories.length,
    categories
  });
});

// ===============================
// GET REQUESTS FROM SUPABASE
// ===============================

app.get("/api/requests", async (req, res) => {
  try {
    const data = await supabaseRequest(
      "service_requests?select=*&order=id.desc"
    );

    const requests = data.map(item => ({
      id: item.id,
      name: item.customer_name,
      phone: item.phone,
      location: item.address,
      service: item.service,
      details: item.description,
      status: item.status
    }));

    res.json({
      success: true,
      count: requests.length,
      requests
    });

  } catch (error) {
    console.error("GET REQUESTS ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not load service requests.",
      error: error.message
    });
  }
});

// ===============================
// CREATE REQUEST IN SUPABASE
// ===============================

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
        message: "Name, phone, location and service are required."
      });
    }

    const newRequestData = {
      customer_name: String(name).trim(),
      phone: String(phone).trim(),
      service: String(service).trim(),
      address: String(location).trim(),
      description: String(details || "").trim(),
      status: "New"
    };

    const data = await supabaseRequest(
      "service_requests",
      {
        method: "POST",
        body: JSON.stringify(newRequestData)
      }
    );

    const saved = data[0];

    const request = {
      id: saved.id,
      name: saved.customer_name,
      phone: saved.phone,
      location: saved.address,
      service: saved.service,
      details: saved.description,
      status: saved.status
    };

    res.status(201).json({
      success: true,
      message: "Service request created successfully.",
      request
    });

  } catch (error) {
    console.error("CREATE REQUEST ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not create service request.",
      error: error.message
    });
  }
});

// ===============================
// GET ONE REQUEST
// ===============================

app.get("/api/requests/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const data = await supabaseRequest(
      `service_requests?id=eq.${id}&select=*`
    );

    if (!data.length) {
      return res.status(404).json({
        success: false,
        message: "Request not found."
      });
    }

    const item = data[0];

    res.json({
      success: true,
      request: {
        id: item.id,
        name: item.customer_name,
        phone: item.phone,
        location: item.address,
        service: item.service,
        details: item.description,
        status: item.status
      }
    });

  } catch (error) {
    console.error("GET ONE REQUEST ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not load request.",
      error: error.message
    });
  }
});

// ===============================
// UPDATE STATUS
// ===============================

app.patch("/api/requests/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "New",
      "Accepted",
      "Assigned",
      "Completed",
      "Cancelled"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status."
      });
    }

    const data = await supabaseRequest(
      `service_requests?id=eq.${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status
        })
      }
    );

    if (!data.length) {
      return res.status(404).json({
        success: false,
        message: "Request not found."
      });
    }

    const item = data[0];

    res.json({
      success: true,
      message: "Request status updated.",
      request: {
        id: item.id,
        name: item.customer_name,
        phone: item.phone,
        location: item.address,
        service: item.service,
        details: item.description,
        status: item.status
      }
    });

  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not update request status.",
      error: error.message
    });
  }
});

// ===============================
// 404
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Hey Karigar route not found."
  });
});

// ===============================
// START
// ===============================

app.listen(PORT, () => {
  console.log(`Hey Karigar running on port ${PORT}`);
});
