const { each, always, prop } = require('rvl-pipe')
const {
  createExchange,
  createQueue,
  bindQueue,
  createChannel,
  channelPrefetch,
  consumeQueue,
  sendTopicMessage
} = require('./common')
const cuid = require('cuid')

const logging = msgProp => ctx => {
  console.log(msgProp(ctx))
  return ctx
}
module.exports.logging = logging

const initExchanges = each(
  createExchange(
    always('messages'),
    always('topic'),
    always({ durable: true })
  ),
  createExchange(
    always('messages-retry'),
    always('direct'),
    always({ durable: true })
  ),
  createExchange(
    always('messages-dlx-short'),
    always('fanout'),
    always({ durable: true })
  ),
  createExchange(
    always('messages-dlx-long'),
    always('fanout'),
    always({ durable: true })
  ),
  createExchange(
    always('messages-dlx-longest'),
    always('fanout'),
    always({ durable: true })
  ),
  createExchange(
    always('messages-dlx-dead'),
    always('fanout'),
    always({ durable: true })
  )
)

const createDelayQueue = (queueName, exchangeName, retry) =>
  each(
    createQueue(
      always(queueName),
      always({
        durable: true,
        ...((retry && {
          arguments: {
            'x-dead-letter-exchange': 'messages-retry'
          }
        }) ||
          {})
      })
    ),
    bindQueue(prop(queueName), always(exchangeName), always(''))
  )

const createDelayQueues = each(
  createDelayQueue('messages-short', 'messages-dlx-short', true),
  createDelayQueue('messages-long', 'messages-dlx-long', true),
  createDelayQueue('messages-longest', 'messages-dlx-longest', true),
  createDelayQueue('messages-dead', 'messages-dlx-dead', false)
)

const propFn = fn => ctx => ctx[fn(ctx)]

const TaskResult = {
  SUCCESS: 'success',
  FAILED: 'failed',
  FAILED_NO_RETRY: 'failed-no-retry',
  FAILED_RETRY_IMMEDIATELY: 'failed-retry-immediately'
}

module.exports.TaskResult = TaskResult

const retryExchanges = [
  'messages-dlx-short',
  'messages-dlx-long',
  'messages-dlx-longest',
  'messages-dlx-dead',
  'messages'
]

const getNextExchangeIndex = (retry, result) => {
  if (result === TaskResult.FAILED_NO_RETRY) {
    return 3
  }

  if (result === TaskResult.FAILED_RETRY_IMMEDIATELY) {
    return 4
  }

  return retry
}

const getNextTopic = (nextExchangeIndex, queueName, topicName) => {
  if (nextExchangeIndex >= 0 && nextExchangeIndex <= 3) {
    return queueName
  }

  return topicName
}

const consume = (
  keyProp,
  queueNameProp,
  consumerFunction,
  prefetchProp = always(1)
) =>
  each(
    logging(ctx => `Registering consumer for: ${queueNameProp(ctx)}`),
    createChannel(),
    channelPrefetch(prefetchProp),
    initExchanges,
    createDelayQueues,
    createQueue(queueNameProp, always({ durable: true })),
    bindQueue(propFn(queueNameProp), always('messages'), keyProp),
    bindQueue(propFn(queueNameProp), always('messages-retry'), queueNameProp),
    consumeQueue(queueNameProp, ctx => {
      const msg = JSON.parse(ctx.msg.content)
      return consumerFunction({ ...ctx, msg })
        .then(result => {
          ctx.ack()
          return { result }
        })
        .catch(error => {
          ctx.ack()
          return { result: TaskResult.FAILED_NO_RETRY, error }
        })
        .then(({ result, error }) => {
          if (result === TaskResult.SUCCESS) {
            return
          }
          console.log(result)
          const retry = msg.meta.retry || 0
          const nextExchangeIndex = getNextExchangeIndex(retry, result)
          const nextTopic = getNextTopic(
            nextExchangeIndex,
            queueNameProp(ctx),
            keyProp(ctx)
          )

          return sendTask(
            always(nextTopic),
            always(msg.body),
            always(retryExchanges[nextExchangeIndex]),
            always({ ...msg.meta, retry: retry + 1, error })
          )(ctx)
        })
    })
  )
module.exports.consume = consume

const sendTask = (
  topicProp,
  bodyProp,
  exchangeProp = always('messages'),
  metaProp
) =>
  each(
    sendTopicMessage(exchangeProp, topicProp, ctx =>
      JSON.stringify({
        meta: (metaProp && metaProp(ctx)) || {
          uuid: cuid(),
          topic: topicProp(ctx),
          retry: 0
        },
        body: bodyProp(ctx)
      })
    )
  )

module.exports.sendTask = sendTask
