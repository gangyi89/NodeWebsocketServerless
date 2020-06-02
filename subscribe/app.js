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
  console.log("receive subscribe request");

  const postData = JSON.parse(event.body).data;

  const updateParams = {
    TableName: TABLE_NAME,
    Key: { connectionId: event.requestContext.connectionId },
    UpdateExpression: "set #channel = :channel",
    ExpressionAttributeNames: { "#channel": "channel" },
    ExpressionAttributeValues: { ":channel": postData },
    ReturnValues: "UPDATED_NEW",
  };

  try {
    await ddb.update(updateParams).promise();
  } catch (e) {
    console.log("logging update item error message");
    console.log(e.stack);
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: "Subscribe Channel Updated" };
};
