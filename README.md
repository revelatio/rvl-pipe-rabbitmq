# rvl-pipe-rabbitmq

A very small set of boilerplate functions for rabbitMQ common uses based on [rvl-pipe](https://github.com/revelatio/rvl-pipe) async-style functions.

Includes task queue producer/consumer based on [Work Queues at RabbitMQ Tutorial](https://www.rabbitmq.com/tutorials/tutorial-two-javascript.html) and topics publishing/consumer based on [Topics at RabbitMQ Tutorial](https://www.rabbitmq.com/tutorials/tutorial-five-javascript.html)

Abstracts some quirks of builing queue producers/consumers by providing an small/reduced set of functions to do exactly a few features.

## API

API is comprised of only 8 functions. 2 for open and close AMQP connections, 4 for task queue consumer/producer and acknoledgement and 2 for publishing/consuming topic messages.

- `
