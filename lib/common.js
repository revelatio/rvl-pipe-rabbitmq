const amqplib = require('amqplib')
const { always, each } = require('rvl-pipe')

const merge = (a, b) => Object.assign({}, a, b)

const createChannel = () => ctx => {
  return ctx.amqpConnection.createConfirmChannel()
    .then(channel => merge(ctx, { amqpChannel: channel }))
}

const channelPrefetch = queueSize => ctx => {
  ctx.amqpChannel.prefetch(queueSize(ctx))
  return ctx
}

const assertQueue = queueProp => ctx => {
  return ctx.amqpChannel.assertQueue(queueProp(ctx), { durable: true })
    .then(() => ctx)
}

const assertTopicExchange = exchangeProp => ctx => {
  return ctx.amqpChannel.assertExchange(exchangeProp(ctx), 'topic', { durable: false })
    .then(() => ctx)
}

const assertTopicExchangeQueueAndBind = (exchangeProp, keysProp) => ctx => {
  return ctx.amqpChannel.assertQueue('', { exclusive: true })
    .then(queue => {
      const keys = keysProp(ctx)
      const exchange = exchangeProp(ctx)

      keys.forEach(key => {
        ctx.amqpChannel.bindQueue(queue.queue, exchange, key)
      })

      ctx.amqpQueue = queue
      return ctx
    })
}

const sentToQueue = (queueProp, messageProp) => ctx => {
  ctx.amqpChannel.sendToQueue(
    queueProp(ctx),
    Buffer.from(messageProp(ctx))
  )

  return ctx.amqpChannel.waitForConfirms()
    .then(() => ctx)
}

const consumeQueue = (queueProp, consumerFn) => ctx => {
  ctx.amqpChannel.consume(queueProp(ctx), msg => {
    if (msg !== null) {
      consumerFn(
        { ...ctx,
          ...{
            msg,
            ack: () => ctx.amqpChannel.ack(msg),
            nack: () => ctx.amqpChannel.nack(msg)
          }
        }
      )
    }
  })

  return ctx
}

const consumeTopicQueue = (consumerFn) => ctx => {
  ctx.amqpChannel.consume(
    ctx.amqpQueue.queue,
    msg => {
      if (msg !== null) {
        consumerFn({ ...ctx, msg })
      }
    },
    { noAck: true }
  )

  return ctx
}

const publishMessage = (exchangeProp, keyProp, messageProp) => ctx => {
  ctx.amqpChannel.publish(exchangeProp(ctx), keyProp(ctx), Buffer.from(messageProp(ctx)))

  return ctx.amqpChannel.waitForConfirms()
    .then(() => ctx)
}

module.exports.connectAMQP = connectionString => ctx => {
  return amqplib.connect(connectionString)
    .then(conn => merge(ctx, { amqpConnection: conn }))
}

module.exports.closeAMQP = () => ctx => {
  return ctx.amqpConnection.close()
    .then(() => {
      delete ctx['amqpConnection']
      return ctx
    })
}

module.exports.sendTaskMessage = (queueProp, messageProp) => ctx => {
  return each(
    createChannel(),
    assertQueue(queueProp),
    sentToQueue(queueProp, messageProp)
  )(ctx)
}

module.exports.consumeTaskQueue = (queueProp, consumerFn) => ctx => {
  return each(
    createChannel(),
    assertQueue(queueProp),
    channelPrefetch(always(1)),
    consumeQueue(queueProp, consumerFn)
  )(ctx)
}

module.exports.messageAck = () => ctx => {
  ctx.ack()
  return ctx
}

module.exports.messageNoAck = () => ctx => {
  ctx.nack()
  return ctx
}

module.exports.sendTopicMessage = (exchangeProp, keyProp, messageProp) => ctx => {
  return each(
    createChannel(),
    assertTopicExchange(exchangeProp),
    publishMessage(exchangeProp, keyProp, messageProp)
  )(ctx)
}

module.exports.consumeTopicsMessages = (exchangeProp, keysProp, consumerFn) => ctx => {
  return each(
    createChannel(),
    assertTopicExchange(exchangeProp),
    assertTopicExchangeQueueAndBind(exchangeProp, keysProp),
    consumeTopicQueue(consumerFn)
  )(ctx)
}
