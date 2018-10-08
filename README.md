# rvl-pipe-rabbitmq

A very small set of boilerplate functions for rabbitMQ common uses based on [rvl-pipe](https://github.com/revelatio/rvl-pipe) async-style functions.

Includes task queue producer/consumer based on [Work Queues at RabbitMQ Tutorial](https://www.rabbitmq.com/tutorials/tutorial-two-javascript.html) and topics publishing/consumer based on [Topics at RabbitMQ Tutorial](https://www.rabbitmq.com/tutorials/tutorial-five-javascript.html)

Abstracts some quirks of builing queue producers/consumers by providing an small/reduced set of functions to do exactly a few features.

## API

API is comprised of only 8 functions. 2 for open and close AMQP connections, 4 for task queue consumer/producer and acknowledgement and 2 for publishing/consuming topic messages.

- `connectAMQP(amqp_url: String):AsyncPipeFunction`: Returns an async-pipe function that connects to the AMQP server specifyed in the url param  and adds the connection to the context as `amqpConnection` prop.

```javascript
const producer = each(
  connectAMQP(process.env.RABBITMQ_URL),

  // Do more things here
)

producer()
  .then(ctx => {
    // ctx.amqpConnection exists
  })
```

- `closeAMQP(): AsyncPipeFunction`: Returns an async-pipe function that closes any existing AMQP connection on the context by its property `amqpConnection`

```javascript
const producer = each(
  connectAMQP(process.env.RABBITMQ_URL),

  // Do some things here

  closeAMQP()
)

producer()
```

### Task Queues

We added 4 basic functions to help with creating tasks queues consumer, producers and acknowledgment.

- `sendTaskMessage(queueQuery: AsyncPipeQuery, messageQuery: AsyncPipeQuery):AsyncPipeFunction`: Creates an async-pipe function that once called sends a task message to the specifyed queue. Both queue and message parameters are async-pipe queries, meaning they are simple functions that take the context as param and return a value.

To send a simple task queue message we only need to:

```javascript
const emailPayload = JSON.stringify({
  dest: 'john@amazingapp.com',
  type: 'welcome'
})

const produceEmailTask = each(
  connectAMQP(process.env.RABBITMQ_URL),
  sendTaskMessage(always('emails'), always(emailPayload)))
  closeAMQP()
)

produceEmailTask()
```

- `consumeTaskQueue(queueQuery: AsyncPipeQuery, consumerFn:AsyncPipeFunction):AsyncPipeFunction`: Creates an async-pipe function that consumes tasks messages using a consumer function. The consumer function gets access to the context created so it can make use of any resources existing on the context.

```javascript
const consumeEmailTask = each(
  ctx => {
    console.log('MSG: ', ctx.msg.content.toString())
    return ctx
  },
  createDocument(               // MongoDB connection is available here
    'email-payloads',
    props({
      id: cuid,
      msg: ctx => ctx.msg.content.toString()
    }),
    'email-payload'
  ),
  messageAck()
)

const consume = each(
  connectMongoDB(process.env.MONGODB_URL, process.env.MONGODB_NAME),
  connectAMQP(process.env.AMQP_URL),
  consumeTaskQueue(always('emails'), consumeEmailTask)
)

consume()
  .then(ctx => {
    console.log('Consumer started')
  })
```

- `messageAck():AsyncPipeFunction`: Creates an async-pipe function to send the acknowledge message back to AMQP server that we processed the message correctly.
- `messageNoAct():AsyncPipeFunction`: Same as `messageAck` but to signal that we could not process the message.

```javascript
const consumeEmailTask = each(
  ctx => {
    console.log('MSG: ', ctx.msg.content.toString())
    return ctx
  },
  ensure(
    each(
      createDocument(
        'email-payloads',
        props({
          id: cuid,
          msg: ctx => ctx.msg.content.toString()
        }),
        'email-payload'
      ),
      messageAck()
    ),
    messageNoAck()            // If previous function fails, then send noAck
  )
)

const consume = each(
  connectMongoDB(process.env.MONGODB_URL, process.env.MONGODB_NAME),
  connectAMQP(process.env.AMQP_URL),
  consumeTaskQueue(always('emails'), consumeEmailTask)
)

consume()
  .then(ctx => {
    console.log('Consumer started')
  })
```

### Topics

For a simpler pub/sub scheme we provide 2 functions to send messages to an named exchange using a topic key. Same for subscribing to messages.

- `sendTopicMessage(exchangeQuery: AsyncPipeQuery, keyQuery: AsyncPipeQuery, messageQuery:AsyncPipeQuery):AsyncPipeFunction`: Returns a function that sends a topic message to an exchange using a key.

```javascript
const notify = each(
  connectAMQP(process.env.AMQP_URL),
  sendTopicMessage(
    always('notifications'),
    always('email.sent'),
    prop('message')
  ),
  closeAMQP()
)

notify({ message: 'Emailed user, welcome' })
  .then(ctx => {
    console.log('Notification sent')
  })
```

- `consumeTopicsMessage(exchangeQuery: AsyncPipeQuery, keyQuery: AsyncPipeQuery, consumerFn: AsyncPipeFunction):AsyncPipeFunction`: Creates an async-pipe function that will consume messages sent to the defined exchange and key pattern.

```javascript
const consumeNotification = each(
  ctx => {
    console.log(
      " [x] %s:'%s'",
      ctx.msg.fields.routingKey,
      ctx.msg.content.toString()
    )
    return ctx
  }
)

const consumeEmailNotifications = each(
  connectAMQP(process.env.AMQP_URL),
  consumeTopicsMessages(
    always('notifications'),
    always('email.*'),
    consumeNotification
  )
)

consumeEmailNotifications()
  .then(ctx => {
    console.log('Subscribed to email notifications')
  })
```

Same as `consumeTaskQueue` the function to process messages receives the context, so you can initialize resources first and then start processing messages.

Notice that, topic subscripcions don't need to acknowledge messages. Is possible to lose messages if no subscriber is available when notifications are fired.




