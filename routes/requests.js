const router = require('express').Router();

let requests = [];
let nextId = 1;

// New service request
router.post('/', (req, res) => {
  const request = {
    id: nextId++,
    service: req.body.service || 'General Service',
    name: req.body.name || '',
    phone: req.body.phone || '',
    address: req.body.address || '',
    problem: req.body.problem || '',
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  requests.push(request);

  res.json({
    success: true,
    message: 'Request received successfully',
    request
  });
});

// Get all requests
router.get('/', (req, res) => {
  res.json(requests);
});

// Accept a request
router.put('/:id/accept', (req, res) => {
  const request = requests.find(r => r.id === Number(req.params.id));

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Request not found'
    });
  }

  request.status = 'ACCEPTED';

  res.json({
    success: true,
    request
  });
});

module.exports = router;
