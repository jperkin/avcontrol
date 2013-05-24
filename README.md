## avcontrol

This is a node-based Audio/Visual control system.  It currently supports:

 - Art-Net based DMX Lighting
 - OpenZWave binary power switches via USB (Aeon ZStick)

The aim is to provide a user interface for people to control lighting and AV
from a portable device.  In the future, support will be added for:

* Audio streaming
* Audio zone mixers (based on PGA2310 ICs)
* Video/HDMI switching

and possibly some other things.

It is currently in production use running on a Raspberry Pi for the West
Central coffee shop and Christ Central church in Redhill, UK.

## Installing

Simply run

    $ npm install
    $ node app

Then connect to http://yourhost:3000/

## Configuration

There is some simple configuration at the top of `app.js`

* `artnethost` is the IP address to send ArtNet packets to.
* `sessionsecret` is the Express.js session secret password.

There are also currently a hardcoded admin user with the password `secret`
(line 40).

## TODO

Yes, there is lots to do, and the code is terribly messy.  For now I've only
been concentrating on getting a working system, the cleanup can come later.

Please help with UI/UX, my design skills are terrible!
