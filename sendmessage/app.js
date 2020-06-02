// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require("aws-sdk");

const ddb = new AWS.DynamoDB.DocumentClient({
  apiVersion: "2012-08-10",
  region: process.env.AWS_REGION,
});

const { TABLE_NAME } = process.env;

exports.handler = async (event) => {
  let connectionData;
  let senderData;
  console.log("receive send message request");

  const postData = JSON.parse(event.body).data;

  //Get the sender's channel
  const getParam = {
    TableName: TABLE_NAME,
    Key: { connectionId: event.requestContext.connectionId },
  };
  try {
    senderData = await ddb.get(getParam).promise();
    console.log("return sender data");
    console.log(senderData);
  } catch (e) {
    console.log("get item error message");
    console.log(e.stack);
    return { statusCode: 500, body: e.stack };
  }
  //TO-DO scan is not optimised, but it gets the job done
  const params = {
    TableName: TABLE_NAME,
    ProjectionExpression: "connectionId",
    FilterExpression: "#channel = :channel",
    ExpressionAttributeNames: { "#channel": "channel" },
    ExpressionAttributeValues: { ":channel": senderData.Item.channel },
  };

  try {
    connectionData = await ddb.scan(params).promise();
    // connectionData = await ddb
    //   .scan({ TableName: TABLE_NAME, ProjectionExpression: "connectionId" })
    //   .promise();
  } catch (e) {
    console.log("logging db query error message");
    console.log(e.stack);
    return { statusCode: 500, body: e.stack };
  }

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });

  const postCalls = connectionData.Items.map(async ({ connectionId }) => {
    try {
      await apigwManagementApi
        .postToConnection({ ConnectionId: connectionId, Data: postData })
        .promise();
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb
          .delete({ TableName: TABLE_NAME, Key: { connectionId } })
          .promise();
      } else {
        throw e;
      }
    }
  });

  try {
    await Promise.all(postCalls);
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: "Data sent." };
};
