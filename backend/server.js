const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===============================
// HEY KARIGAR DATA
// ===============================

let requests = [];
let nextRequestId = 1;

// All service categories
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
// HOME / HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    app: "Hey Karigar",
    message: "Hey Karigar backend is running",
    version: "1.0.0"
  });
});

// ===============================
// API INFO
// ===============================

app.get("/api", (req, res) => {
  res.json({
    success: true,
    app: "Hey Karigar",
    message: "API is working",
    endpoints: [
      "/api/categories",
      "/api/requests",
      "/api/requests/:id",
      "/api/requests/:id/status"
    ]
  });
});

// ===============================
// GET ALL CATEGORIES
// ===============================

app.get("/api/categories", (req, res) => {
  res.json({
    success: true,
    count: categories.length,
    categories
  });
});

// ===============================
// GET ALL SERVICE REQUESTS
// ===============================

app.get("/api/requests", (req, res) => {
  res.json({
    success: true,
    count: requests.length,
    requests
  });
});

// ===============================
// CREATE SERVICE REQUEST
// ===============================

app.post("/api/requests", (req, res) => {
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

  const newRequest = {
    id: nextRequestId++,
    name: String(name).trim(),
    phone: String(phone).trim(),
    location: String(location).trim(),
    service: String(service).trim(),
    details: String(details || "").trim(),
    status: "New",
    createdAt: new Date().toISOString()
  };

  requests.push(newRequest);

  res.status(201).json({
    success: true,
    message: "Service request created successfully.",
    request: newRequest
  });
});

// ===============================
// GET ONE REQUEST
// ===============================

app.get("/api/requests/:id", (req, res) => {
  const id = Number(req.params.id);

  const request = requests.find(item => item.id === id);

  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Request not found."
    });
  }

  res.json({
    success: true,
    request
  });
});

// ===============================
// UPDATE REQUEST STATUS
// ===============================

app.patch("/api/requests/:id/status", (req, res) => {
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

  const request = requests.find(item => item.id === id);

  if (!request) {
    return res.status(404).json({
      success: false,
      message: "Request not found."
    });
  }

  request.status = status;

  res.json({
    success: true,
    message: "Request status updated.",
    request
  });
});

// ===============================
// 404 HANDLER
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Hey Karigar API route not found."
  });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`Hey Karigar backend running on port ${PORT}`);
});
