#!/bin/bash

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

cd ~/openaps-dev
empty='""'

# check carelink is working - if not send notification

python -m decocare.stick $(python -m decocare.scan) >/dev/null || curl -X POST -H "Content-Type: application/json" -d '{"value1":"Problem reading stick"}' https://maker.ifttt.com/trigger/OpenAPS-Carelink/with/key/vLFIe4_EyCP3iZWBF_hx3 

echo "Carelink Stick OK"

# check carelink can talk to pump - if not send notification
model=$(openaps use pump model)
echo "Model: " $model
#if [  -z model ];
if [ x$model = x$empty ];
then
  echo "Model is empty"
  curl -X POST -H "Content-Type: application/json" -d '{"value1":"Cannot read model number","value2":"Check Carelink is in range","value3":"Check pump battery and alarms"}' https://maker.ifttt.com/trigger/OpenAPS-Carelink/with/key/vLFIe4_EyCP3iZWBF_hx3
fi

