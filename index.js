const router = module.exports = require('express').Router();

router.use('/offices', require('./offices'));
router.use('/employees', require('./employees'));
router.use('/users', require('./users'));