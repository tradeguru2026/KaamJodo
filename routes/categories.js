const router = require('express').Router();

const categories = [
  "Electrician",
  "Plumber",
  "Carpenter",
  "Painter",
  "AC Repair",
  "Refrigerator Repair",
  "Washing Machine Repair",
  "TV Repair",
  "Geyser Repair",
  "Cooler Repair",
  "RO / Water Purifier Repair",
  "Mobile Repair",
  "Computer / Laptop Repair",
  "CCTV Installation",
  "Generator Mechanic",
  "Car Mechanic",
  "Bike Mechanic",
  "Puncture Repair",
  "Tyre Replacement",
  "Mason / Raj Mistri",
  "Tile Worker",
  "Welder",
  "Glass Worker",
  "Gutter Cleaning",
  "Carpet / Kaleen Cleaning",
  "House Cleaning",
  "Sofa Cleaning",
  "Pest Control",
  "Gardener / Mali",
  "Barber",
  "Makeup Artist",
  "Mehndi Artist",
  "Physiotherapist",
  "Laundry / Ironing",
  "Packers & Movers",
  "Driver",
  "Cook",
  "Tailor",
  "Beauty Parlour",
  "Event Decoration"
];

router.get("/", (req, res) => {
  res.json({
    success: true,
    count: categories.length,
    categories
  });
});

module.exports = router;
