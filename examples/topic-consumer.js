require('dotenv').config()

const { each, always, prop } = require('rvl-pipe')
const {
  connectAMQP,
  consumeTopicsMessages
} = require('../')

const consumeNotification = each(
  ctx => {
    console.log(" [x] %s:'%s'", ctx.msg.fields.routingKey, ctx.msg.content.toString())
    return ctx
  }
)

const consume = each(
  connectAMQP(process.env.AMQP_URL),
  consumeTopicsMessages(always('notifications'), prop('keys'), consumeNotification)
)

if (process.argv.length !== 3) {
  console.log('Needs the key')
  process.exit(1)
}

consume({ keys: [process.argv[2]] })
  .then(ctx => {
    console.log('Consumer started')
  })
  .catch(err => {
    console.log(err)
  })
