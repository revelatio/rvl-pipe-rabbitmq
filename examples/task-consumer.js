require('dotenv').config()

const { each, always, iff, equals, prop } = require('rvl-pipe')
const {
  connectAMQP,

  consumeTaskQueue,

  messageAck,
  messageNoAck
} = require('../')

const consumeDeploys = each(
  iff(
    equals(prop('header'), ctx => ctx.msg.content.toString()[0]),
    each(
      ctx => {
        console.log('MSG: ', ctx.msg.content.toString())
        return ctx
      },
      messageAck()
    ),
    each(
      ctx => {
        console.log('REJCTING: ', ctx.msg.content.toString())
        return ctx
      },
      messageNoAck()
    )
  )
)

const consume = each(
  connectAMQP(process.env.AMQP_URL),
  consumeTaskQueue(always('deploys'), consumeDeploys)
)

if (process.argv.length !== 3) {
  console.log('Needs the header')
  process.exit(1)
}

consume({ header: process.argv[2] })
  .then(ctx => {
    console.log('Consumer started')
  })
  .catch(err => {
    console.log(err)
  })
