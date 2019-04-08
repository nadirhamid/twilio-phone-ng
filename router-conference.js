const express = require('express')
const bodyParser = require('body-parser')
const sessionVerification = require('./middlewares/session-verification.js')
const sessionError = require('./middlewares/session-error.js')
const loadUser = require('./middlewares/load-user.js')

const router = express.Router({ mergeParams: true }) // eslint-disable-line new-cap

router.use(bodyParser.urlencoded({
  extended: true,
}))

router.use(sessionVerification.callback)
router.use(loadUser)
router.use(sessionError.callback)

const phone = require('./controllers/phone.js')

router.route('/add').post(phone.add);
router.route('/added').post(phone.added);
module.exports = router
