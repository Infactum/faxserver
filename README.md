faxserver
=========
FaxServer is ExpressJS web-GUI for smart handling outgoing t.38 faxes through Asterisk. More info can be found [here](http://habrahabr.ru/post/207080/).  
Requirements
------------
1. Asterisk with AMI and fax dialplan (see below)
2. Node.JS
3. Redis server  
Installation
------------
1. Clone this repo
2. npm install
3. bower install
4. node app.js  
Asterisk configuration
-----------------
You should add below code to the asterisk dialplan. This will make Asterisk generated user events with fax status information.

```
[OutgoingFaxInit]
exten => _X.,1,NoOp()
 same => n,Set(GROUP()=faxout)
 same => n,Set(DB(fax_group_count/${UUID})=${GROUP_COUNT(faxout)})
 same => n,GotoIf($[${DB(fax_group_count/${UUID})}<=${MAX_PARALLELISM}]?call)
 same => n,UserEvent(Fax,uuid: ${UUID},Status: CALL SUSPENDED)
 same => n,HangUp()
 same => n(call),Dial(Local/${EXTEN}@OutgoingCalls)
 same => n,HangUp()

exten => router,1,NoOp()
 same => n,Set(__UUID=${UUID})
 same => n,Set(__DATA=${DATA})
 same => n,Dial(Local/fax@OutgoingFax)
 same => n,HangUp()

exten => failed,1,NoOp()
 same => n,GotoIf($[${DB_DELETE(fax_group_count/${UUID})}<=${MAX_PARALLELISM}]?:end)
 same => n,UserEvent(Fax,uuid: ${UUID},Status: CALL PICKUP FAILED)
 same => n(end),HangUp()

[OutgoingFax]
exten => fax,1,NoOp()
 same => n,UserEvent(Fax,uuid: ${UUID},Status: CALL PICKUP SUCCESS);
 same => n,Set(DB(fax_sendstatus/${UUID})=0)
 same => n,Playback(autofax)
 same => n,Set(FAXOPT(headerinfo)=Company)
 same => n,Set(FAXOPT(localstationid)=XXX-XX-XX)
 same => n,Set(DB(fax_sendstatus/${UUID})=1)
 same => n,SendFax(${DATA})
 same => n,HangUp()

exten => h,1,NoOp()
 same => n,GotoIf($[${DB_DELETE(fax_sendstatus/${UUID})}]?sendstatus)
 same => n,UserEvent(Fax,uuid: ${UUID},Status: FAX SEND FAILED)
 same => n,Goto(end)
 same => n(sendstatus),UserEvent(Fax,uuid: ${UUID},Status: FAX SEND ${FAXOPT(status)})
 same => n(end),NoOp()
```
You should also enable Asterisk AMI and add user with propper rights like this:
```
[general]
enabled=yes

[FAX]
secret=password
read=user
write=originate
```

Configuration
-------------
All settings are avaliable in config/config.json. Here is some hints on them:  
__port__ - Port of webserver.  
__language__ - Overall transltation. EN or RU avaliable. Other languages can be added in translation folder.  
__uploadDir__ - Distanation where PDF files will be uploaded.  
__storageDir__ - Distanation where TIFF faxes will be stored.  
__gsCommand__ - Command for GhostScript (used for PDF->TIFF converion).  
__maxParallelism__ - Number of maximum simultaneous fax calls.  
__maxRetry__ - How much times try to send fax before fail.  
__retryInterval__ - Interval beetween retry calls in seconds.  
__delayedProcessingInterval__ - Interval beetween delayed faxes queue check in seconds.  
__AMI__ - Settings of Asterisk AMI connection.  
