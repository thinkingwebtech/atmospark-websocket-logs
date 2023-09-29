import dotenv from 'dotenv'
import axios from 'axios'
import fs, { appendFileSync } from 'fs'
import WebSocket from "ws";
import ADMIN from "./Model/SuperAdmin.js";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
dotenv.config();

let ipToDevice = {};
const s3Client = new S3Client({
  region: process.env.S3_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.S3_BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.S3_BUCKET_SECRET_ACCESS_KEY
  }
});

const getObjectUrl = async (key) => {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key
  });
  const url = await getSignedUrl(s3Client, command);
  return { url, key };
};

const putObjectUrl = async (key, mimetype) => {
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: key,
    contentType: mimetype
  };
  const command = new PutObjectCommand(params);
  const url = await getSignedUrl(s3Client, command);
  return { url, key };
};


class Csv {
  // Water production after system_enable and check undefine not to add in the .csv file
  constructor(ip, message_id, timestamp, system_enable, operating_mode, ambient_temp_c, ambient_rh, ambient_ah, hv_stage_temp_c, hv_stage_rh, hv_stage_ah, hv_stage_dp, condenser_stage_temp_c, condenser_stage_rh, condenser_stage_ah, condenser_surface_temp_c, blower_demand, blower_drive, hv_demand, hv_drive, condenser_demand, condenser_drive, Air_Flow_PIDiState, hv_PIDiState, Condenser_PIDiState, condenser_control_sp, hv_control_sp, blower_control_sp, value) {
    this.ip = ip;
    this.message_id = message_id;
    this.timestamp = timestamp;
    this.system_enable = system_enable;
    this.operating_mode = operating_mode;
    this.ambient_temp_c = ambient_temp_c;
    this.ambient_rh = ambient_rh;
    this.ambient_ah = ambient_ah;
    this.hv_stage_temp_c = hv_stage_temp_c;
    this.hv_stage_rh = hv_stage_rh;
    this.hv_stage_ah = hv_stage_ah;
    this.hv_stage_dp = hv_stage_dp;
    this.condenser_stage_temp_c = condenser_stage_temp_c;
    this.condenser_stage_rh = condenser_stage_rh;
    this.condenser_stage_ah = condenser_stage_ah;
    this.condenser_surface_temp_c = condenser_surface_temp_c;
    this.blower_demand = blower_demand;
    this.blower_drive = blower_drive;
    this.hv_demand = hv_demand;
    this.hv_drive = hv_drive;
    this.condenser_demand = condenser_demand;
    this.condenser_drive = condenser_drive;
    this.Air_Flow_PIDiState = Air_Flow_PIDiState;
    this.hv_PIDiState = hv_PIDiState;
    this.Condenser_PIDiState = Condenser_PIDiState;
    this.condenser_control_sp = condenser_control_sp;
    this.hv_control_sp = hv_control_sp;
    this.blower_control_sp = blower_control_sp;
    this.value = value;
  }
  saveAsCSV() {
    const csv = `${this.message_id},${this.timestamp},${this.system_enable},${this.operating_mode},${this.ambient_temp_c},${this.ambient_rh},${this.ambient_ah},${this.hv_stage_temp_c},${this.hv_stage_rh},${this.hv_stage_ah},${this.hv_stage_dp},${this.condenser_stage_temp_c},${this.condenser_stage_rh},${this.condenser_stage_ah},${this.condenser_surface_temp_c},${this.blower_demand},${this.blower_drive},${this.hv_demand},${this.hv_drive},${this.condenser_demand},${this.condenser_drive},${this.Air_Flow_PIDiState},${this.hv_PIDiState},${this.Condenser_PIDiState},${this.condenser_control_sp},${this.hv_control_sp},${this.blower_control_sp},${this.value}\n`;
    try {
      appendFileSync(`${this.ip}.csv`, csv);
    } catch (err) {
      console.error(err);
    }
  }
}

let ipArray;
let wsArray;
async function getIpList() {
  const users = await ADMIN.findOne();
  ipArray = users.users.map((data) => {
    let buffer;
    try {
      buffer = fs.readFileSync(`${data.deviceCode}.csv`);
    } catch (error) {
      fs.open(`${data.deviceCode}.csv`, 'w', (error, file) => {
        if (error) {
          console.log('Error');
        }
        else {
          appendFileSync(`${data.deviceCode}.csv`, 'water_production_rate,message_id,timestamp,date_time,system_enable,extraction_efficiency,operating_mode,ambient_temp_c,ambient_rh,ambient_ah,hv_stage_temp_c,hv_stage_rh,hv_stage_ah,hv_stage_dp,condenser_stage_temp_c,condenser_stage_rh,condenser_stage_ah,condenser_surface_temp_c,blower_demand,blower_drive,hv_demand,hv_drive,condenser_demand,condenser_drive,Air_Flow_PIDiState,hv_PIDiState,Condenser_PIDiState,condenser_control_sp,hv_control_sp,blower_control_sp\n');
        }
      })
    }
    ipToDevice[data.ipaddress] = data.deviceCode;
    return 'ws://' + data.ipaddress + '/ws';
  });
  wsArray = ipArray.map((data) => {
    return new WebSocket(data);
  });
  wsArray?.map((ws) => {
    ws.on('message', function (data) {
      const CFM = 261
      const dataBuffer = Buffer.from(data);
      const dataString = dataBuffer.toString('utf8');
      const jsonData = JSON.parse(dataString);
      let blowerDrive = parseFloat(jsonData.blower_drive)
      let ambientAbsoluteHumidity = parseFloat(jsonData?.ambient_ah)
      let condenserAbsoluteHumidity = parseFloat(jsonData?.condenser_stage_ah)
      let humidityDiff = ambientAbsoluteHumidity - condenserAbsoluteHumidity;
      const extractionEfficiency = ((humidityDiff) / ambientAbsoluteHumidity) * 100;
      const value = CFM * (blowerDrive / 100) * humidityDiff * 1.699 * 0.9 * 24 / 3785
      jsonData['value'] = value;
      const ip = ws._url.split('/');
      const { message_id, timestamp, system_enable, operating_mode, ambient_temp_c, ambient_rh, ambient_ah, hv_stage_temp_c, hv_stage_rh, hv_stage_ah, hv_stage_dp, condenser_stage_temp_c, condenser_stage_rh, condenser_stage_ah, condenser_surface_temp_c, blower_demand, blower_drive, hv_demand, hv_drive, condenser_demand, condenser_drive, Air_Flow_PIDiState, hv_PIDiState, Condenser_PIDiState, condenser_control_sp, hv_control_sp, blower_control_sp } = jsonData;
      const contact1 = new Csv(ipToDevice[ip[2]], value, message_id, timestamp, new Date(), system_enable, extractionEfficiency, operating_mode, ambient_temp_c, ambient_rh, ambient_ah, hv_stage_temp_c, hv_stage_rh, hv_stage_ah, hv_stage_dp, condenser_stage_temp_c, condenser_stage_rh, condenser_stage_ah, condenser_surface_temp_c, blower_demand, blower_drive, hv_demand, hv_drive, condenser_demand, condenser_drive, Air_Flow_PIDiState, hv_PIDiState, Condenser_PIDiState, condenser_control_sp, hv_control_sp, blower_control_sp);
      if (timestamp !== undefined) contact1.saveAsCSV();
    });
    ws.on('error', (data) => { console.log('Error', ws._url) });
    ws.on('close', (data) => { });
  });
}

getIpList();

setInterval(async () => {
  wsArray.map((ws) => {
    ws.close();
  });
  function getFormattedDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-based
    const year = date.getFullYear().toString();
    return { path: `${year}/${month}`, date: `${month}-${day}-${year}` };
  }
  const today = new Date();
  const yesterday = new Date(today);
  const formattedDate = getFormattedDate(yesterday);
  const key = ipArray.map(async (data) => {
    let ip = data.split('/');
    return putObjectUrl(ipToDevice[ip[2]] + '/' + formattedDate.path + '/' + formattedDate.date, 'text/csv');
  })
  const presignedUrls = await Promise.all(key);
  presignedUrls.map(async (data) => {
    const path = data?.key?.split('/')[0] + '.csv';
    const buffer = fs.readFileSync(path);
    await axios.put(data?.url, buffer);
  });
  getIpList()
}, 60 * 1000)

setInterval(async () => {
  const users = await ADMIN.findOne();
  ipArray = users.users.map((data) => {
    fs.unlink(`${data.deviceCode}.csv`, () => {
      fs.open(`${data.deviceCode}.csv`, 'w', (error, file) => {
        if (error) {
          console.log('Error');
        }
        else {
          appendFileSync(`${data.deviceCode}.csv`, 'water_production_rate,message_id,timestamp,date_time,system_enable,extraction_efficiency,operating_mode,ambient_temp_c,ambient_rh,ambient_ah,hv_stage_temp_c,hv_stage_rh,hv_stage_ah,hv_stage_dp,condenser_stage_temp_c,condenser_stage_rh,condenser_stage_ah,condenser_surface_temp_c,blower_demand,blower_drive,hv_demand,hv_drive,condenser_demand,condenser_drive,Air_Flow_PIDiState,hv_PIDiState,Condenser_PIDiState,condenser_control_sp,hv_control_sp,blower_control_sp\n');
        }
      })
    });
  });
}, 24 * 60 * 60 * 1000);