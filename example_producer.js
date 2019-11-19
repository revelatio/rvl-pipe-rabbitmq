const { connectAMQP, closeAMQP } = require('./index')
const { each, always } = require('rvl-pipe')
const { sendTask, logging } = require('./lib/retriable')

const sendMeme = each(
  connectAMQP(process.env.RABBITMQ_URL),
  sendTask(always('meme.send'), always({ meme: 'This works!' })),
  closeAMQP(),
  logging(always('Notification sent!'))
)

sendMeme().catch(err => console.log(err))
