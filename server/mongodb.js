import {MongoClient} from 'mongodb';
import {mongoConfig} from '../config/mongodb.js';
import {TABLES} from './engine.js';
export async function connection(){
 const config=mongoConfig();
 // Reuse one pool per warm Vercel process, including development reloads.
 if(!globalThis.__slMongo)globalThis.__slMongo=new MongoClient(config.uri,config.options).connect().catch(e=>{delete globalThis.__slMongo;throw e;});
 const client=await globalThis.__slMongo;return {client,db:client.db(config.database)};
}
export async function createIndexes(db){
 for(const name of TABLES)await db.collection(name).createIndex({id:1},{unique:true});
 await db.collection('Accounts').createIndex({username:1},{unique:true,collation:{locale:'en',strength:2}});
 await db.collection('Reports').createIndex({accountId:1,date:1},{unique:true});
 await db.collection('Reports').createIndex({date:1});
 await db.collection('Orders').createIndex({accountId:1,date:1});
 await db.collection('Orders').createIndex({saleAccountId:1,date:1});
 await db.collection('Orders').createIndex({date:1,customerName:1});
 await db.collection('Assignments').createIndex({accountId:1,productId:1},{unique:true});
 await db.collection('Targets').createIndex({accountId:1,month:1,productId:1},{unique:true});
 await db.collection('Sessions').createIndex({accountId:1});
 await db.collection('Sessions').createIndex({expires:1});
 await db.collection('Sessions').createIndex({expireAt:1},{expireAfterSeconds:0});
 await db.collection('Notifications').createIndex({recipientId:1,createdAt:-1,id:-1});
 await db.collection('Notifications').createIndex({recipientId:1,readAt:1});
 await db.collection('Audit').createIndex({actorId:1,action:1,'details.requestId':1});
 await db.collection('Audit').createIndex({'details.reportId':1,time:-1});
 await db.collection('ReportRequests').createIndex({accountId:1,status:1,date:1});
 await db.collection('RateLimits').createIndex({expiresAt:1},{expireAfterSeconds:0});
 await db.collection('_meta').updateOne({_id:'write-sequence'},{$setOnInsert:{version:0}},{upsert:true});
}
