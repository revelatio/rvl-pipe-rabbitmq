const {
  connectAMQP,
  closeAMQP,

  consumeTaskQueue,
  sendTaskMessage,

  messageAck,
  messageNoAck,

  sendTopicMessage,
  consumeTopicsMessages
} = require('./lib/common')

module.exports = {
  connectAMQP,
  closeAMQP,

  consumeTaskQueue,
  sendTaskMessage,

  messageAck,
  messageNoAck,

  sendTopicMessage,
  consumeTopicsMessages
}
