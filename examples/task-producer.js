require('dotenv').config()

const { each, always, loop, set } = require('rvl-pipe')
const {
  connectAMQP,
  closeAMQP,
  sendTaskMessage
} = require('../')

const randomLetter = () => (Math.random() > 0.5) ? 'H' : 'F'

const produce = each(
  connectAMQP(process.env.AMQP_URL),

  set(always({ index: 0 })),
  loop(
    ctx => ctx.index < ctx.count,
    each(
      sendTaskMessage(
        always('deploys'),
        ctx => `${randomLetter()}${ctx.message} ${ctx.index}`
      ),
      ctx => {
        ctx.index += 1
        return ctx
      }
    )
  ),

  closeAMQP()
)

if (process.argv.length !== 4) {
  console.log('Needs the message and count')
  process.exit(1)
}

produce({
  message: process.argv[2],
  count: parseInt(process.argv[3])
})
  .then(ctx => {
    console.log('Messages sent')
  })
  .catch(err => {
    console.log(err)
  })
