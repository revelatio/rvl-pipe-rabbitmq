const { connectAMQP } = require('./lib/common')
const { logging, TaskResult, sendTask, consume } = require('./lib/retriable')
const { all, each, always, prop, props } = require('rvl-pipe')

const consumeMemeSendTask = each(
  logging(
    ctx =>
      `SEND [x] META: ${JSON.stringify(ctx.msg.meta)} BODY:'${JSON.stringify(
        ctx.msg.body
      )}'`
  ),
  // Send State Task
  sendTask(
    always('meme.state'),
    props({ taskId: prop('msg.meta.uuid'), result: 'done' })
  ),
  always(TaskResult.SUCCESS)
)

const consumeMemeStateTask = each(
  logging(
    ctx =>
      `STAT [x] META: ${JSON.stringify(ctx.msg.meta)} BODY:'${JSON.stringify(
        ctx.msg.body
      )}'`
  ),
  always(TaskResult.SUCCESS)
)

const memeConsumers = each(
  connectAMQP(process.env.RABBITMQ_URL),
  all(
    consume(always('meme.send'), always('meme-send'), consumeMemeSendTask),
    consume(always('meme.state'), always('meme-state'), consumeMemeStateTask)
  )
)

memeConsumers().catch(err => {
  console.log(err)
})
