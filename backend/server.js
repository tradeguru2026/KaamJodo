const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Temporary in-memory storage
let requests = [];
let nextId = 1;

// Home / health check
app.get("/", (req, res) => {
  res.json({
    success: true,
    app: "KaamJodo",
    message: "KaamJodo backend is running"
  });
});

// Get all service requests
app.get("/api/requests", (req, res) => {
  res.json({
    success: true,
    count: requests.length,
    requests
  });
});

// Create a new service request
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
    id: nextId++,
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

// Get one request
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

// Update request status
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

app.listen(PORT, () => {
  console.log(`KaamJodo backend running on port ${PORT}`);
});
