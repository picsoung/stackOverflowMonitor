'use strict';

var request = require('request');
var rp = require('request-promise-native')
const faunadb = require('faunadb');
const q = faunadb.query;
const client = new faunadb.Client({
  secret: process.env.FAUNADB_SECRET
});

module.exports.getStackOverflowQuestions = (event, context, callback) => {
  let url = 'https://api.stackexchange.com'
  url += '/2.2/search/advanced?pagesize=1&order=desc&sort=creation&site=stackoverflow'
  url += '&q=' + process.env.SEARCH_KEYWORD
  url += '&key=' + process.env.STACK_EXCHANGE_KEY

  rp({
     method: 'GET',
     uri: url,
     gzip: true
   }).then(function(result){
     let question = JSON.parse(result).items[0]
     let question_in_db = client.query(q.Get(
        q.Match(
          q.Index('questions_by_id'),
          question.question_id)))

      question_in_db.then(function(a){ // exists in DB
        console.log('exists', a);
      }).catch(function(err){ // does not exist
        console.log('err',err)
        client.query(
          q.Create(
            q.Class('questions'),
              {data: question }
            ));
        sendToSlack(question);
      });
   }).catch(function(err){
     console.log('err_', err)
   })
};

function sendToSlack(q){
    console.log('SEND TO SLACK');
    let requestData = {
      channel: process.env.SLACK_CHANNEL,
      icon_url: process.env.SLACK_ICON_URL,
      username: process.env.SLACK_USERNAME,
      text: 'New question on <'+q.link+'|'+'StackOverflow>',
      unfurl_links: true,
      attachments: [
        {
          fallback: 'New question on StackOverflow',
          color: '#36a64f',
          author_name: q.owner.display_name,
          author_link: q.owner.link,
          author_icon: q.owner.profile_image,
          title: q.title,
          title_link: q.link,
          footer: 'SlackOverflow Notification',
          footer_icon: process.env.SLACK_ICON_URL,
          ts: q.creation_date,
          unfurl_links: true,
          fields: [
                {
                    title: '# Views',
                    value: q.view_count,
                    short: true
                },
                {
                    title: '# Answers',
                    value: q.answer_count,
                    short: true
                },
                {
                    title: 'Answered',
                    value: q.is_answered ? '✅' : '🚫',
                    short: true
                },
                {
                    title: 'Tags',
                    value: q.tags.join(', '),
                    short: true
                }
            ]
        }
      ]
    }
    let options = {
      url: process.env.SLACK_WEBHOOK_URL,
      method: 'POST',
      json: requestData
    }

    request(options).then(function(err,res){
      if(err)
        console.log('sendToSlack ERR', err);
    })
}
