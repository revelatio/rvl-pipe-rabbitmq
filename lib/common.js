const amqplib = require('amqplib')
const { always, each } = require('rvl-pipe')

const merge = (a, b) => Object.assign({}, a, b)

const createChannel = () => ctx => {
  return ctx.amqpConnection
    .createConfirmChannel()
    .then(channel => merge(ctx, { amqpChannel: channel }))
}

const assertQueue = queueProp => ctx => {
  return ctx.amqpChannel
    .assertQueue(queueProp(ctx), { durable: true })
    .then(() => ctx)
}

const assertTopicExchange = exchangeProp => ctx => {
  return ctx.amqpChannel
    .assertExchange(exchangeProp(ctx), 'topic', { durable: false })
    .then(() => ctx)
}

const createExchange = (exchangeNameProp, typeProp, optionsProp) => ctx => {
  return ctx.amqpChannel
    .assertExchange(exchangeNameProp(ctx), typeProp(ctx), optionsProp(ctx))
    .then(() => ctx)
}

const channelPrefetch = countProp => ctx => {
  ctx.amqpChannel.prefetch(countProp(ctx))
  return ctx
}

const createQueue = (queueNameProp, optionsProp) => ctx => {
  const queueName = queueNameProp(ctx)
  return ctx.amqpChannel
    .assertQueue(queueName, optionsProp(ctx))
    .then(queue => merge(ctx, { [queueName]: queue }))
}

const bindQueue = (queueProp, exchangeNameProp, keyProp) => ctx => {
  ctx.amqpChannel.bindQueue(
    queueProp(ctx).queue,
    exchangeNameProp(ctx),
    keyProp(ctx)
  )
  return ctx
}

const assertTopicExchangeQueueAndBind = (
  queueNameProp,
  exchangeProp,
  keysProp
) => ctx => {
  return ctx.amqpChannel
    .assertQueue(queueNameProp(ctx), { durable: true })
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
  ctx.amqpChannel.sendToQueue(queueProp(ctx), Buffer.from(messageProp(ctx)))

  return ctx.amqpChannel.waitForConfirms().then(() => ctx)
}

const consumeQueue = (queueProp, consumerFn) => ctx => {
  ctx.amqpChannel.consume(queueProp(ctx), msg => {
    if (msg !== null) {
      consumerFn({
        ...ctx,
        msg,
        ack: () => ctx.amqpChannel.ack(msg),
        nack: () => ctx.amqpChannel.nack(msg)
      })
    }
  })

  return ctx
}

const consumerQueue = (queueProp, consumerFn) => ctx => {
  ctx.amqpChannel.consume(
    queueProp(ctx),
    msg => {
      if (msg !== null) {
        const payload = JSON.parse(msg.content)
        consumerFn({ ...ctx, msg: payload })
      }
    },
    { noAck: true }
  )

  return ctx
}

const consumeTopicQueue = consumerFn => ctx => {
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
  ctx.amqpChannel.publish(
    exchangeProp(ctx),
    keyProp(ctx),
    Buffer.from(messageProp(ctx))
  )

  return ctx.amqpChannel.waitForConfirms().then(() => ctx)
}

const connectAMQP = connectionString => ctx => {
  return amqplib
    .connect(connectionString)
    .then(conn => merge(ctx, { amqpConnection: conn }))
}

const closeAMQP = () => ctx => {
  return ctx.amqpConnection.close().then(() => {
    delete ctx.amqpConnection
    return ctx
  })
}

const sendTaskMessage = (queueProp, messageProp) => ctx => {
  return each(
    createChannel(),
    assertQueue(queueProp),
    sentToQueue(queueProp, messageProp)
  )(ctx)
}

const consumeTaskQueue = (queueProp, consumerFn) => ctx => {
  return each(
    createChannel(),
    assertQueue(queueProp),
    channelPrefetch(always(1)),
    consumeQueue(queueProp, consumerFn)
  )(ctx)
}

const messageAck = () => ctx => {
  ctx.ack()
  return ctx
}

const messageNoAck = () => ctx => {
  ctx.nack()
  return ctx
}

const sendTopicMessage = (exchangeProp, keyProp, messageProp) => ctx => {
  return each(
    createChannel(),
    // assertTopicExchange(exchangeProp),
    publishMessage(exchangeProp, keyProp, messageProp)
  )(ctx)
}

const consumeTopicsMessages = (
  exchangeProp,
  keysProp,
  queueNameProp,
  consumerFn
) => ctx => {
  return each(
    createChannel(),
    assertTopicExchange(exchangeProp),
    assertTopicExchangeQueueAndBind(queueNameProp, exchangeProp, keysProp),
    consumeTopicQueue(consumerFn)
  )(ctx)
}

module.exports = {
  connectAMQP,
  closeAMQP,
  createChannel,
  createExchange,
  createQueue,
  bindQueue,
  consumerQueue,
  consumeQueue,
  sendTaskMessage,
  consumeTaskQueue,
  messageAck,
  messageNoAck,
  sendTopicMessage,
  consumeTopicsMessages,
  channelPrefetch
}
