require('dotenv').config()

const { each, prop } = require('rvl-pipe')
const {
  connectAMQP,
  closeAMQP,
  sendTopicMessage
} = require('../')

const produce = each(
  connectAMQP(process.env.AMQP_URL),
  sendTopicMessage(prop('exchange'), prop('key'), prop('message')),
  closeAMQP()
)

if (process.argv.length !== 5) {
  console.log('Needs: exchange, key and message')
  process.exit(1)
}

produce({
  exchange: process.argv[2],
  key: process.argv[3],
  message: process.argv[4]
})
  .then(ctx => {
    console.log('Message sent')
  })
  .catch(err => {
    console.log(err)
  })
