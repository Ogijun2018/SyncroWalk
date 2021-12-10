﻿"use strict";

const g_elementDivJoinScreen = document.getElementById("div_join_screen");
const g_elementDivChatScreen = document.getElementById("div_chat_screen");
const g_elementInputUserName = document.getElementById("input_username");
const join_alert = document.getElementById("alert");
const sum_momentum = document.getElementById("sum");
const word = document.getElementById("word");

const g_elementDivUserInfo = document.getElementById("div_userinfo");
const g_tmp = document.getElementById("tmp");
const g_elementTextUserName = document.getElementById("text_username");
const smartphoneScreen = document.getElementById("smartphone");
const desktopScreen = document.getElementById("desktop");

let filterData = { x: 0, y: 0, z: 0 };
let axis_result = { x: 0, y: 0, z: 0 };
let deviceMotionData = { x: 0, y: 0, z: 0 };
let deviceOrientationData = { gamma: null, beta: null, alpha: null };
let username = "";
let labelData = [];

let g_mapRtcPeerConnection = new Map();

let stepCount = 0;
let filterCount = 0;
let allCount = 0;

const dict = [
  "学生",
  "乗り物",
  "ゲーム",
  "転がす",
  "吹雪",
  "着る",
  "スマートフォン",
  "映画館",
  "カレンダー",
];

// クライアントからサーバーへの接続要求
const g_socket = io.connect();

const IAM = {
  token: null,
};

function logCount() {
  console.log("logCount: ", allCount);
}

setInterval(logCount, 1000);

function device() {
  var ua = navigator.userAgent;
  if (
    ua.indexOf("iPhone") > 0 ||
    ua.indexOf("iPod") > 0 ||
    (ua.indexOf("Android") > 0 && ua.indexOf("Mobile") > 0)
  ) {
    return "mobile";
  } else if (ua.indexOf("iPad") > 0 || ua.indexOf("Android") > 0) {
    return "tablet";
  } else {
    return "desktop";
  }
}

if (device() === "mobile") {
  smartphoneScreen.style.display = "flex";
} else if (device() === "desktop") {
  desktopScreen.style.display = "flex";
}

function onsubmitButton_Join() {
  console.log("UI Event : 'Join' button clicked.");

  // ユーザー名
  let strInputUserName = g_elementInputUserName.value;
  username = g_elementInputUserName.value;
  if (!strInputUserName) {
    join_alert.style.display = "block";
    return;
  }
  g_elementTextUserName.value = strInputUserName;

  // サーバーに"join"を送信
  console.log("- Send 'Join' to server");
  g_socket.emit("join", {});

  // 画面の切り替え
  g_elementDivJoinScreen.style.display = "none"; // 参加画面の非表示
  g_elementDivChatScreen.style.display = "flex"; // チャット画面の表示
}

function deviceMotion(e) {
  e.preventDefault();
  let ac = e.acceleration;

  if (filterCount < 5) {
    // save the last 3-axis samples to the shift registers
    // for sum filtering
    filterCount++;
    filterData.x += ac.x;
    filterData.y += ac.y;
    filterData.z += ac.z;
    return;
  } else {
    filterCount = 0;
    axis_result = {
      x: filterData.x / 5,
      y: filterData.y / 5,
      z: filterData.z / 5,
    };
    filterData = { x: 0, y: 0, z: 0 };
  }

  let resultVector = Math.sqrt(
    Math.pow(axis_result.x, 2) +
      Math.pow(axis_result.y, 2) +
      Math.pow(axis_result.z, 2)
  );

  // 動的精度はとりあえず1.0の固定値
  if (resultVector > 4.0) {
    stepCount++;
    allCount++;
    sum_momentum.innerHTML = allCount;
    SendDeviceInfo();
  } else {
    return;
  }
}

function deviceOrientation(e) {}

function ClickRequestDeviceSensor() {
  //. ユーザーに「許可」を明示させる必要がある
  DeviceOrientationEvent.requestPermission()
    .then(function (response) {
      if (response === "granted") {
        window.addEventListener("deviceorientation", deviceOrientation);
        $("#sensorrequest").css("display", "none");
      }
    })
    .catch(function (e) {
      console.log(e);
    });

  DeviceMotionEvent.requestPermission()
    .then(function (response) {
      if (response === "granted") {
        window.addEventListener("devicemotion", deviceMotion);
        $("#sensorrequest").css("display", "none");
      }
    })
    .catch(function (e) {
      console.log(e);
    });
}

// スマホ（DeviceOrientationEventが取得できるか）判定
if (window.DeviceOrientationEvent) {
  // iOS13かそれ以上かを判定
  console.log("requestPermission");
  if (
    DeviceOrientationEvent.requestPermission &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    $("#div_chat_screen").css("display", "none");
    var banner =
      '<div id="sensorrequest" onclick="ClickRequestDeviceSensor();"><p id="sensoricon">>></p></div>';
    $("#div_join_screen").prepend(banner);
  } else {
    window.addEventListener("deviceorientation", deviceOrientation);
  }
}

if (window.DeviceMotionEvent) {
  if (
    DeviceMotionEvent.requestPermission &&
    typeof DeviceMotionEvent.requestPermission === "function"
  ) {
  } else {
    window.addEventListener("devicemotion", deviceMotion);
  }
}

window.addEventListener("beforeunload", (event) => {
  event.preventDefault();
  stopSendData(); // チャットからの離脱
  g_socket.disconnect(); // Socket.ioによるサーバーとの接続の切断
  e.returnValue = ""; // Chrome では returnValue を設定する必要がある
  return ""; // Chrome 以外では、return を設定する必要がある
});

function SendDeviceInfo() {
  if (!g_mapRtcPeerConnection.size) {
    alert("Connection object does not exist!!!");
    return;
  }
  // メッセージをDataChannelを通して相手に直接送信
  g_mapRtcPeerConnection.forEach((rtcPeerConnection) => {
    console.log("- Send Message through DataChannel");
    rtcPeerConnection.datachannel.send(
      JSON.stringify({
        type: "message",
        data: {
          stepCount,
          username,
        },
        from: IAM.token,
      })
    );
  });
}

function stopSendData() {
  g_mapRtcPeerConnection.forEach((rtcPeerConnection) => {
    if (isDataChannelOpen(rtcPeerConnection)) {
      // 離脱の通知をDataChannelを通して相手に直接送信
      rtcPeerConnection.datachannel.send(
        JSON.stringify({ type: "leave", data: username })
      );
    }
    endPeerConnection(rtcPeerConnection);
  });
  // g_elementTextUserName.value = "";
}

// 接続時の処理
// サーバー側で "connection" , クライアント側で "connect" 発生
g_socket.on("connect", () => {
  console.log("Socket Event : connect");
});

g_socket.on("token", (data) => {
  IAM.token = data.token;
});

// サーバーからのメッセージ受信に対する処理
// ・サーバー側のメッセージ拡散時の「io.broadcast.emit( "signaling", objData );」に対する処理
g_socket.on("signaling", (objData) => {
  console.log("Socket Event : signaling");
  console.log(objData);
  console.log("- type : ", objData.type);
  console.log("- data : ", objData.data);
  console.log("- device: ", objData.device);

  // 送信元のSocketID
  let strRemoteSocketID = objData.from;
  console.log("- from : ", objData.from);

  if (device() !== "desktop" && !g_elementTextUserName.value) {
    // 自身がまだ参加していないときは、"signaling"イベントを無視。
    console.log("Ignore 'signaling' event because I haven't join yet.");
    return;
  }

  if ("join" === objData.type) {
    // onclickButton_CreateOfferSDP()、onclickButton_SendOfferSDP()と同様の処理

    if (g_mapRtcPeerConnection.get(strRemoteSocketID)) {
      // 既にコネクションオブジェクトあり
      alert("Connection object already exists.");
      return;
    }

    // RTCPeerConnectionオブジェクトの作成
    console.log("Call : createPeerConnection()");
    let rtcPeerConnection = createPeerConnection(strRemoteSocketID);
    g_mapRtcPeerConnection.set(strRemoteSocketID, rtcPeerConnection); // グローバル変数に設定

    // DataChannelの作成
    let datachannel = rtcPeerConnection.createDataChannel("datachannel");
    // DataChannelオブジェクトをRTCPeerConnectionオブジェクトのメンバーに追加。
    console.log("dataChannel = ", datachannel);
    rtcPeerConnection.datachannel = datachannel;
    // DataChannelオブジェクトのイベントハンドラの構築
    console.log("Call : setupDataChannelEventHandler()");
    setupDataChannelEventHandler(rtcPeerConnection);

    // OfferSDPの作成
    console.log("Call : createOfferSDP()");
    createOfferSDP(rtcPeerConnection);
  } else if ("offer" === objData.type) {
    // onclickButton_SetOfferSDPandCreateAnswerSDP()と同様の処理
    // 設定するOffserSDPとして、テキストエリアのデータではなく、受信したデータを使用する。

    if (g_mapRtcPeerConnection.get(strRemoteSocketID)) {
      // 既にコネクションオブジェクトあり
      alert("Connection object already exists.");
      return;
    }

    // RTCPeerConnectionオブジェクトの作成
    console.log("Call : createPeerConnection()");
    let rtcPeerConnection = createPeerConnection(strRemoteSocketID);
    g_mapRtcPeerConnection.set(strRemoteSocketID, rtcPeerConnection); // グローバル変数に設定

    // OfferSDPの設定とAnswerSDPの作成
    console.log("Call : setOfferSDP_and_createAnswerSDP()");
    setOfferSDP_and_createAnswerSDP(rtcPeerConnection, objData.data); // 受信したSDPオブジェクトを渡す。

    // リモートユーザー名の設定
    //g_elementTextRemoteUserName.value = objData.username;
    // リモート情報表示用のHTML要素の追加
    if (device() === "desktop" && objData.device !== "desktop") {
      console("appendRemoteInfoElement");
      appendRemoteInfoElement(strRemoteSocketID, objData.username);
    }
  } else if ("answer" === objData.type) {
    // onclickButton_SetAnswerSDPthenChatStarts()と同様の処理
    // 設定するAnswerSDPとして、テキストエリアのデータではなく、受信したデータを使用する。

    let rtcPeerConnection = g_mapRtcPeerConnection.get(strRemoteSocketID);

    if (!rtcPeerConnection) {
      // コネクションオブジェクトがない
      alert("Connection object does not exist!!");
      return;
    }

    // AnswerSDPの設定
    console.log("Call : setAnswerSDP()");
    setAnswerSDP(rtcPeerConnection, objData.data); // 受信したSDPオブジェクトを渡す。

    // リモートユーザー名の設定
    //g_elementTextRemoteUserName.value = objData.username;
    // リモート情報表示用のHTML要素の追加
    if (device() === "desktop" && objData.device !== "desktop") {
      appendRemoteInfoElement(strRemoteSocketID, objData.username);
    }
  } else if ("candidate" === objData.type) {
    let rtcPeerConnection = g_mapRtcPeerConnection.get(strRemoteSocketID);

    if (!rtcPeerConnection) {
      // コネクションオブジェクトがない
      alert("Connection object does not exist!");
      return;
    }
    // ICE candidateの追加
    console.log("Call : addCandidate()");
    addCandidate(rtcPeerConnection, objData.data); // 受信したICE candidateの追加
  } else {
    console.error("Unexpected : Socket Event : signaling");
  }
});

// DataChannelオブジェクトのイベントハンドラの構築
function setupDataChannelEventHandler(rtcPeerConnection) {
  if (!("datachannel" in rtcPeerConnection)) {
    console.error("Unexpected : DataChannel does not exist.");
    return;
  }

  // message イベントが発生したときのイベントハンドラ
  rtcPeerConnection.datachannel.onmessage = (event) => {
    console.log("DataChannel Event : message");
    let objData = JSON.parse(event.data);

    if ("message" === objData.type) {
      // 受信メッセージをメッセージテキストエリアへ追加
      let stepCount = objData.data.stepCount;
      allCount++;
      sum_momentum.innerHTML = allCount;
      word.innerHTML = dict[Math.floor(allCount / 100)];
      // 歩数更新
      let temp = labelData.find((v) => v.y === objData.data.username);
      temp.step = stepCount;
      chart.update();
    } else if ("offer" === objData.type) {
      // 受信したOfferSDPの設定とAnswerSDPの作成
      console.log("Call : setOfferSDP_and_createAnswerSDP()");
      setOfferSDP_and_createAnswerSDP(rtcPeerConnection, objData.data);
    } else if ("answer" === objData.type) {
      // 受信したAnswerSDPの設定
      console.log("Call : setAnswerSDP()");
      setAnswerSDP(rtcPeerConnection, objData.data);
    } else if ("candidate" === objData.type) {
      // 受信したICE candidateの追加
      console.log("Call : addCandidate()");
      addCandidate(rtcPeerConnection, objData.data);
    } else if ("leave" === objData.type) {
      console.log("Call : endPeerConnection()");
      let num = labelData.findIndex((v) => v.y === objData.data);
      chart.data.labels.splice(num, 1);
      chart.data.datasets.forEach((dataset) => {
        dataset.data.splice(num, 1);
      });
      chart.update();
      endPeerConnection(rtcPeerConnection);
    }
  };
}

// DataChannelが開いているか
function isDataChannelOpen(rtcPeerConnection) {
  if (!("datachannel" in rtcPeerConnection)) {
    // datachannelメンバーが存在しない
    return false;
  }
  if (!rtcPeerConnection.datachannel) {
    // datachannelメンバーがnull
    return false;
  }
  if ("open" !== rtcPeerConnection.datachannel.readyState) {
    // datachannelメンバーはあるが、"open"でない。
    return false;
  }
  // DataCchannelが開いている
  return true;
}

function createPeerConnection(strRemoteSocketID) {
  let config = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };
  let rtcPeerConnection = new RTCPeerConnection(config);
  // チャット相手のSocketIDをRTCPeerConnectionオブジェクトのメンバーに追加
  rtcPeerConnection.strRemoteSocketID = strRemoteSocketID;
  // RTCPeerConnectionオブジェクトのイベントハンドラの構築
  setupRTCPeerConnectionEventHandler(rtcPeerConnection);
  return rtcPeerConnection;
}

function endPeerConnection(rtcPeerConnection) {
  removeRemoteInfoElement(rtcPeerConnection.strRemoteSocketID);

  // DataChannelの終了
  if ("datachannel" in rtcPeerConnection) {
    rtcPeerConnection.datachannel.close();
    rtcPeerConnection.datachannel = null;
  }
  // グローバル変数Mapから削除
  g_mapRtcPeerConnection.delete(rtcPeerConnection.strRemoteSocketID);
  // ピアコネクションの終了
  rtcPeerConnection.close();
}

function setupRTCPeerConnectionEventHandler(rtcPeerConnection) {
  // セッションネゴシエーションを必要とする変更が発生したときに発生する。
  rtcPeerConnection.onnegotiationneeded = () => {
    console.log("Event : Negotiation needed");
    if (!isDataChannelOpen(rtcPeerConnection)) {
      // チャット前
      // OfferSDPの作成は、ユーザーイベントから直接呼び出すので、
      // Negotiation Neededイベントは無視する。
    } else {
      // チャット中
      // OfferSDPを作成し、DataChannelを通して相手に直接送信
      console.log("Call : createOfferSDP()");
      createOfferSDP(rtcPeerConnection);
    }
  };

  // ICE candidate イベントが発生したときのイベントハンドラ
  // - これは、ローカルのICEエージェントがシグナリング・サーバを介して
  //   他のピアにメッセージを配信する必要があるときはいつでも発生する。
  //   これにより、ブラウザ自身がシグナリングに使用されている技術についての詳細を知る必要がなく、
  //   ICE エージェントがリモートピアとのネゴシエーションを実行できるようになる。
  rtcPeerConnection.onicecandidate = (event) => {
    console.log("Event : ICE candidate");
    if (event.candidate) {
      // ICE candidateがある
      console.log("- ICE candidate : ", event.candidate);

      // Vanilla ICEの場合は、何もしない
      // Trickle ICEの場合は、ICE candidateを相手に送る

      if (!isDataChannelOpen(rtcPeerConnection)) {
        // チャット前
        // ICE candidateをサーバーを経由して相手に送信
        console.log("- Send ICE candidate to server");
        g_socket.emit("signaling", {
          to: rtcPeerConnection.strRemoteSocketID,
          type: "candidate",
          data: event.candidate,
          device: device(),
        });
      } else {
        // チャット中
        // ICE candidateをDataChannelを通して相手に直接送信
        console.log("- Send ICE candidate through DataChannel");
        rtcPeerConnection.datachannel.send(
          JSON.stringify({ type: "candidate", data: event.candidate })
        );
      }
    } else {
      // ICE candiateがない = ICE candidate の収集終了。
      console.log("- ICE candidate : empty");
    }
  };

  // ICE candidate error イベントが発生したときのイベントハンドラ
  // - このイベントは、ICE候補の収集処理中にエラーが発生した場合に発生する。
  //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onicecandidateerror
  rtcPeerConnection.onicecandidateerror = (event) => {
    console.error(
      "Event : ICE candidate error. error code : ",
      event.errorCode
    );
  };

  // ネゴシエーションプロセス中にICE connection stateが変化するたびに発生する。
  rtcPeerConnection.oniceconnectionstatechange = () => {
    console.log("Event : ICE connection state change");
    console.log(
      "- ICE connection state : ",
      rtcPeerConnection.iceConnectionState
    );
  };

  // ピア接続のsignalStateが変化したときに送信される
  rtcPeerConnection.onsignalingstatechange = () => {
    console.log("Event : Signaling state change");
    console.log("- Signaling state : ", rtcPeerConnection.signalingState);
  };

  // ピア接続の状態が変化したときに送信される
  rtcPeerConnection.onconnectionstatechange = () => {
    console.log("Event : Connection state change");
    console.log("- Connection state : ", rtcPeerConnection.connectionState);
    if ("failed" === rtcPeerConnection.connectionState) {
      // 「ビデオチャット相手との通信が切断」が"しばらく"続き、通信が復帰しないとき、Connection state failedとなる
      endPeerConnection(rtcPeerConnection);
    }
  };

  // createDataChannel() を呼び出すリモートピアによって
  //   RTCDataChannelが接続に追加されたときに送信される
  rtcPeerConnection.ondatachannel = (event) => {
    console.log("Event : Data channel");
    // DataChannelオブジェクトをRTCPeerConnectionオブジェクトのメンバーに追加
    rtcPeerConnection.datachannel = event.channel;
    setupDataChannelEventHandler(rtcPeerConnection);
    createOfferSDP(rtcPeerConnection);
  };
}

// OfferSDPの作成
function createOfferSDP(rtcPeerConnection) {
  // OfferSDPの作成
  console.log("Call : rtcPeerConnection.createOffer()");
  rtcPeerConnection
    .createOffer()
    .then((sessionDescription) => {
      // 作成されたOfferSDPををLocalDescriptionに設定
      console.log("Call : rtcPeerConnection.setLocalDescription()");
      return rtcPeerConnection.setLocalDescription(sessionDescription);
    })
    .then(() => {
      if (!isDataChannelOpen(rtcPeerConnection)) {
        // チャット前
        // 初期OfferSDPをサーバーを経由して相手に送信
        console.log("- Send OfferSDP to server");
        g_socket.emit("signaling", {
          to: rtcPeerConnection.strRemoteSocketID,
          type: "offer",
          data: rtcPeerConnection.localDescription,
          username: g_elementTextUserName.value,
          device: device(),
        });
      } else {
        // チャット中
        // 初期OfferSDPをDataChannelを通して相手に直接送信
        console.log("- Send OfferSDP through DataChannel");
        rtcPeerConnection.datachannel.send(
          JSON.stringify({
            type: "offer",
            data: rtcPeerConnection.localDescription,
          })
        );
      }
    })
    .catch((error) => {
      console.error("Error : ", error);
    });
}

// OfferSDPの設定とAnswerSDPの作成
function setOfferSDP_and_createAnswerSDP(
  rtcPeerConnection,
  sessionDescription
) {
  console.log("Call : rtcPeerConnection.setRemoteDescription()");
  rtcPeerConnection
    .setRemoteDescription(sessionDescription)
    .then(() => {
      // AnswerSDPの作成
      console.log("Call : rtcPeerConnection.createAnswer()");
      return rtcPeerConnection.createAnswer();
    })
    .then((sessionDescription) => {
      // 作成されたAnswerSDPををLocalDescriptionに設定
      console.log("Call : rtcPeerConnection.setLocalDescription()");
      return rtcPeerConnection.setLocalDescription(sessionDescription);
    })
    .then(() => {
      // Vanilla ICEの場合は、まだSDPを相手に送らない
      // Trickle ICEの場合は、初期SDPを相手に送る

      if (!isDataChannelOpen(rtcPeerConnection)) {
        // チャット前
        // 初期AnswerSDPをサーバーを経由して相手に送信
        console.log("- Send AnswerSDP to server");
        g_socket.emit("signaling", {
          to: rtcPeerConnection.strRemoteSocketID,
          type: "answer",
          data: rtcPeerConnection.localDescription,
          username: g_elementTextUserName.value,
          device: device(),
        });
      } else {
        // チャット中
        // 初期AnswerSDPをDataChannelを通して相手に直接送信
        console.log("- Send AnswerSDP through DataChannel");
        rtcPeerConnection.datachannel.send(
          JSON.stringify({
            type: "answer",
            data: rtcPeerConnection.localDescription,
          })
        );
      }
    })
    .catch((error) => {
      console.error("Error : ", error);
    });
}

// AnswerSDPの設定
function setAnswerSDP(rtcPeerConnection, sessionDescription) {
  console.log("Call : rtcPeerConnection.setRemoteDescription()");
  rtcPeerConnection.setRemoteDescription(sessionDescription).catch((error) => {
    console.error("Error : ", error);
  });
}

// ICE candidateの追加
function addCandidate(rtcPeerConnection, candidate) {
  console.log("Call : rtcPeerConnection.addIceCandidate()");
  rtcPeerConnection.addIceCandidate(candidate).catch((error) => {
    console.error("Error : ", error);
  });
}

// リモート情報表示用のHTML要素の追加
function appendRemoteInfoElement(strRemoteSocketID, strUserName) {
  // IDの作成
  let strElementTextID = "text_" + strRemoteSocketID;
  let strElementTableID = "table_" + strRemoteSocketID;
  let strElementChatID = "chat_" + strRemoteSocketID;

  // // text HTML要素の作成
  let elementText = document.createElement("input");
  elementText.id = strElementTextID;
  elementText.type = "text";
  elementText.readOnly = "readonly";
  elementText.value = strUserName;

  // チャット表示
  let elementChat = document.createElement("textarea");
  elementChat.id = strElementChatID;
  elementChat.cols = "40";
  elementChat.rows = "2";
  elementChat.readOnly = true;

  // div HTML要素の作成
  let elementDiv = document.createElement("div");
  elementDiv.id = strElementTableID;
  elementDiv.border = "1px solid black";

  labelData.push({ y: strUserName, step: 0 });
  chart.update();
}

// リモート映像表示用のHTML要素の取得
function getRemoteVideoElement(strRemoteSocketID) {
  let strElementVideoID = "video_" + strRemoteSocketID;

  return document.getElementById(strElementVideoID);
}

// リモート音声用のHTML要素の取得
function getRemoteAudioElement(strRemoteSocketID) {
  let strElementAudioID = "audio_" + strRemoteSocketID;

  return document.getElementById(strElementAudioID);
}

// チャット用のHTML要素の取得
function getRemoteChatElement(strRemoteSocketID) {
  let strElementChatID = "chat_" + strRemoteSocketID;

  return document.getElementById(strElementChatID);
}

// リモート情報表示用のHTML要素の削除
function removeRemoteInfoElement(strRemoteSocketID) {
  let strElementTableID = "table_" + strRemoteSocketID;
  let elementTable = document.getElementById(strElementTableID);

  if (!elementTable) {
    console.error(
      "Unexpected : Remote Video Element is not exist. RemoteSocketID = ",
      strRemoteSocketID
    );
  }
  g_tmp.removeChild(elementTable);
}

var ctx = document.getElementById("myChart").getContext("2d");
var canvas = document.getElementById("myChart");
const cfg = {
  type: "bar",
  data: {
    datasets: [
      {
        label: "Steps",
        data: labelData,
        parsing: {
          xAxisKey: "step",
        },
      },
    ],
  },
  options: {
    responsive: true,
    indexAxis: "y",
    layout: {
      padding: {
        left: 0,
        right: 0,
      },
    },
    scales: {
      x: {
        suggestedMax: 20,
      },
    },
  },
};
Chart.defaults.font.size = 25;
Chart.defaults.font.family = "brandon-grotesque, sans-serif";
var chart = new Chart(ctx, cfg);
