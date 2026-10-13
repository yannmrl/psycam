const PRESETS =
[
    ["acid", "raw"],
    ["acid", "raw", "motionblur"],
    ["acid", "motionblur", "edge"],
    ["motionblur", "acid", "grayscale"],
    ["motionblur", "acid", "grayscale", "posterize"],
    ["motionblur", "acid", "posterize", "rgbshift"],
    ["acid", "pixelated", "edge"],
    ["fragment", "acid", "edge"],
    ["fragment", "pixelated", "acid"],
    ["kaleidoscope", "acid", "edge"],
    ["kaleidoscope", "acid", "edge", "invert"],
    ["kaleidoscope", "acid", "grayscale", "invert"],
    ["kaleidoscope", "acid", "grayscale", "invert", "glitch"],
    ["kaleidoscope", "acid", "grayscale", "invert", "glitch", "rgbshift"],
    ["kaleidoscope", "acid", "grayscale", "invert", "glitch", "rgbshift", "motionblur"],
    ["kaleidoscope", "motionblur", "acid", "raw"],
    ["fragment2", "acid", "edge", "kaleidoscope"],
    ["fragment2", "acid", "edge", "kaleidoscope", "invert", "rgbshift"]
];

let localStream = null;
let remoteStream = null;

let sourceMode = "local"; // or "remote"

const socket = new WebSocket("wss://echo.wysigot.com:443");

socket.onopen = () =>
{
    console.log("connected to web socket server");
    console.log("registering");
    socket.send(JSON.stringify(
    {
        type: "register",
        role: "display",
        token: token
    }));
};

socket.onmessage = async (event) =>
{
    let ic;
    try { ic = JSON.parse(JSON.parse(event.data)); }
    catch { ic = JSON.parse(event.data); }

    console.log("Incoming WS message");
    console.log(ic);

    if (ic.token != token)
    {
        console.log("wrong token");
        return;
    }

    switch(ic.type)
    {
        case "enable":
            effects.enable(ic.effect);
            break;

        case "disable":
            effects.disable(ic.effect);
            break;

        case "flipX":
            flipX = !flipX;
            break;

        case "flipY":
            flipY = !flipY;
            break;
        
        case "clear":
            activeEffects.clear();
            colorFilter = "#ffffff";
            socket.send(JSON.stringify(
            {
                type: "state",
                role: "display",
                token: token,
                effects: JSON.stringify([...activeEffects]),
                color: "#ffffff"
            }));
            break;

        case "color":
            colorFilter = ic.value;
            break;
        
        case "switchmode":
            mode = mode === "auto" ? "manual" : "auto";
            modeManager();

            break;
        
        case "register":
            console.log("sending active effects to controller");

            socket.send(JSON.stringify(
            {
                type: "state",
                role: "display",
                token: token,
                effects: JSON.stringify([...activeEffects]),
                color: (colorFilter) ? colorFilter : ""
            }));
            break;

        case "offer":
            pc = new RTCPeerConnection({iceServers: [{urls: "stun:stun.l.google.com:19302"}]});

            pc.onicecandidate = (event) =>
            {
                if (event.candidate)
                {
                    socket.send(JSON.stringify(
                    {
                        type: "ice",
                        token: token,
                        role: "display",
                        candidate: event.candidate
                    }));
                }
            };

            pc.ontrack = (event) =>
            {
                console.log("webrtc received");

                remoteStream = event.streams[0];

                if(sourceMode === "remote")
                    video.srcObject = remoteStream;

                video.onloadedmetadata = () =>
                {
                    video.play();
                    render();
                };
            };

            pc.onconnectionstatechange = () =>
            {
                console.log("DV1 :", pc.connectionState);
                if (pc.connectionState == "connected")
                    setSource("remote");
                else if (
                    pc.connectionState === "disconnected" ||
                    pc.connectionState === "failed" ||
                    pc.connectionState === "closed"
                )
                {
                    remoteStream = null;

                    setSource("local");
                }
            };

            await pc.setRemoteDescription(ic.offer);

            const answer = await pc.createAnswer();

            await pc.setLocalDescription(answer);

            socket.send(JSON.stringify(
            {
                type: "answer",
                token: token,
                role: "display",
                answer: pc.localDescription
            }));
            break;
        
        case "ice":
            await pc.addIceCandidate(ic.candidate);
            break;

        case "source":
            setSource(ic.source);
            break;
        
        case "tempo":
            bpm = ic.bpm;
            lastTapTime = ic.lastTapTime;
    }
};

socket.onerror = (error) =>
{
    console.error("websocket error :", error);
};

socket.onclose = () =>
{
    console.log("disconnected from websocket server");
};

function setSource(mode)
{
    sourceMode = mode;

    if(
        mode === "local" &&
        localStream
    )
    {
        video.srcObject = localStream;

        console.log("source = webcam DV1");
    }

    if(
        mode === "remote" &&
        remoteStream
    )
    {
        video.srcObject = remoteStream;

        console.log("source = caméra DV2");
    }
}

let token = "";
let pc = null;
if (window.location.href.includes("token="))
    token = window.location.href.split("token=")[1].split('&')[0].split('?')[0];

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d",{ willReadFrequently: true });

const effectsBar = document.getElementById("effectsBar");

const activeEffects = new Set();

let stream;

let bassLevel = 0;
let midLevel = 0;
let highLevel = 0;

let strobePeriod = 2.0;

let rotation = 0; // 0, 90, 180, 270

let previousFrame = null;
let colorFilter = null;
let fitMode = "cover";
let mode = "manual";

let elapsed = 0;

let flipX = false;
let flipY = false;

let mjpegStream = null;
let useMjpeg = false;

let kaleidoSegments = 8;

let feedbackCanvas = document.createElement("canvas");
let feedbackCtx = feedbackCanvas.getContext("2d");

let feedbackAngle = 0;

let cameraMode = "user";

const acidLut = [];

for (let i=0; i<256; i++)
    acidLut[i] = Math.floor(127 + 127 * Math.sin(i*0.08));

let wallCanvas = document.createElement("canvas");
let wallCtx = wallCanvas.getContext("2d");

const params = new URLSearchParams(window.location.search);

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

const ipParam = params.get("ip");

if(ipParam)
{
    mjpegStream = new Image();

    mjpegStream.onload = () =>
    {
        useMjpeg = true;

        console.log(
            "Flux MJPEG connecté :",
            ipParam
        );
    };

    mjpegStream.onerror = () =>
    {
        console.error("Impossible de charger le flux MJPEG");
    };

    let url = ipParam;

    if(!url.startsWith("http://") && !url.startsWith("https://"))
        url = "http://" + url;

    mjpegStream.src = url;
}

const effects =
{
    enable(name)
    {
        activeEffects.add(name);
    },

    disable(name)
    {
        activeEffects.delete(name);
    },

    clear()
    {
        activeEffects.clear();
    },

    list()
    {
        console.table(Object.keys(effectProcessors));
    }
};

window.effects = effects;

function resize()
{
    canvas.width = innerWidth;
    canvas.height = innerHeight;

    feedbackCanvas.width = canvas.width;
    feedbackCanvas.height = canvas.height;

    wallCanvas.width = canvas.width;
    wallCanvas.height = canvas.height;
}

let startY = 0;
let endY = 0;
let isTouching = false;

document.addEventListener("touchstart", (event) =>
{
    isTouching = true;
    startY = event.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", (event) =>
{
    isTouching = false;
    endY = event.changedTouches[0].clientY;

    const deltaY = startY - endY;

    const seuil = 50;

    if (Math.abs(deltaY) < seuil) return;

    if (deltaY > 0) // SWIPE UP
        effectsBar.classList.add("visible");
    else
        effectsBar.classList.remove("visible");
});

window.addEventListener("resize", resize);
resize();

let lastTap = 0;

canvas.addEventListener("touchend", () =>
{
    const now = Date.now();

    if (now - lastTap < 300)
    {
        console.log("cam switch");
        if (cameraMode == "user") cameraMode = "environment";
        else cameraMode = "user";
    }

    lastTap = now;
});

if (window.location.href.includes('screen'))
    navigator.mediaDevices.getDisplayMedia(
    {
        video: {facingMode: {ideal: cameraMode}},
        audio: false
    })
    .then(stream=>
    {
        localStream = stream;
        if(sourceMode === "local")
            video.srcObject = stream;
    })
    .catch(err=>
    {
        alert("Impossible d'accéder à la caméra.");
        console.error(err);
    });
else
    navigator.mediaDevices.getUserMedia(
    {
        video: {facingMode: {ideal: cameraMode}},
        audio: false
    })
    .then(stream=>
    {
        localStream = stream;
        video.srcObject = stream;
    })
    .catch(err=>
    {
        alert("Impossible d'accéder à la caméra.");
        console.error(err);
    });


let frame = 0;

function hexToRgb(hex)
{
    return {
        r: parseInt(hex.slice(1,3),16),
        g: parseInt(hex.slice(3,5),16),
        b: parseInt(hex.slice(5,7),16)
    };
}

function featherEdges()
{
    const img = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const data = img.data;

    const border = 180;

    for (let y = 0; y < canvas.height; y++)
    {
        for (let x = 0; x < canvas.width; x++)
        {
            const p =
                (y * canvas.width + x) * 4;

            const d =
                Math.min(
                    x,
                    y,
                    canvas.width - x,
                    canvas.height - y
                );

            if (d > border)
                continue;

            const fade =
                d / border;

            const noise =
                0.5 +
                0.5 *
                Math.sin(
                    x * 0.08 +
                    y * 0.11 +
                    frame * 0.01
                );

            const alpha =
                Math.max(
                    0,
                    Math.min(
                        1,
                        fade * noise
                    )
                );

            data[p] =
                255 -
                (255 - data[p]) *
                alpha;

            data[p+1] =
                255 -
                (255 - data[p+1]) *
                alpha;

            data[p+2] =
                255 -
                (255 - data[p+2]) *
                alpha;
        }
    }

    ctx.putImageData(
        img,
        0,
        0
    );
}

const effectProcessors =
{
    
    invert(data)
    {
        for(let i=0; i<data.length; i+=4)
        {
            data[i]=255-data[i];
            data[i+1]=255-data[i+1];
            data[i+2]=255-data[i+2];
        }
    },

    thermal(data)
    {
        for(let i=0; i<data.length; i+=4)
        {
            let v = (data[i]+data[i+1]+data[i+2])/3;

            data[i]=
                Math.min(
                    255,
                    v*2
                );
            data[i+1]=
                Math.max(
                    0,
                    255-Math.abs(v-128)*2
                );
            data[i+2]=255-v;
        }
    },

    nightvision(data)
    {
        for (let i=0; i<data.length; i+=4)
        {
            const lum =
                data[i]   * 0.25 +
                data[i+1] * 0.65 +
                data[i+2] * 0.10;

            data[i]   = lum * 0.05;
            data[i+1] = Math.min(255, lum * 1.6);
            data[i+2] = lum * 0.05;
        }
    },

    grayscale(data)
    {
        for (let i=0; i<data.length; i+=4)
        {
            const gray =
                (data[i] * 0.299) +
                (data[i + 1] * 0.587) +
                (data[i + 2] * 0.114);

            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
    },

    posterize(data)
    {
        for(let i=0; i<data.length; i+=4)
        {
            data[i]=Math.floor(data[i]/64)*64;
            data[i+1]=Math.floor(data[i+1]/64)*64;
            data[i+2]=Math.floor(data[i+2]/64)*64;
        }
    },

    rgbshift(data)
    {
        for(let i=0; i<data.length-80; i+=4)
        {
            data[i]=data[i+40];
            data[i+2]=data[i+80];
        }
    },

    glitch(data,w,h)
    {
        const copy = new Uint8ClampedArray(data);

        for(let g=0; g<8; g++)
        {
            const bandY = Math.floor(Math.random() * h);
            const bandH = 10 + Math.floor(Math.random() * 40);

            const offset = Math.floor(Math.random() * 150) - 75;

            for(let y=bandY; y<Math.min(h, bandY + bandH); y++)
            {
                for(let x=0; x<w; x++)
                {
                    const sx = Math.max(0, Math.min(w - 1, x + offset));

                    const src = (y * w + sx) * 4;
                    const dst = (y * w + x) * 4;

                    data[dst]   = copy[src];
                    data[dst+1] = copy[src+1];
                    data[dst+2] = copy[src+2];
                }
            }
        }
    },

    edge(data,w,h)
    {
        const copy = new Uint8ClampedArray(data);

        for(let y=1; y<h-1; y++)
        {
            for(let x=1; x<w-1; x++)
            {
                let idx=(y*w+x)*4;

                let left=(y*w+x-1)*4;
                let right=(y*w+x+1)*4;
                let up=((y-1)*w+x)*4;
                let down=((y+1)*w+x)*4;

                let gx=copy[right]-copy[left];

                let gy=copy[down]-copy[up];

                let mag=Math.abs(gx)+Math.abs(gy);

                data[idx]=mag;
                data[idx+1]=mag;
                data[idx+2]=mag;
            }
        }
    },

    strobe(data)
    {
        const pulse = Math.sin(beatPhase * Math.PI);

        for(let i = 0; i < data.length; i += 4)
        {
            data[i]   *= pulse;
            data[i+1] *= pulse;
            data[i+2] *= pulse;
        }
    },

    strobex2(data)
    {
        const pulse = 2*Math.sin(beatPhase * Math.PI);

        for(let i = 0; i < data.length; i += 4)
        {
            data[i]   *= pulse;
            data[i+1] *= pulse;
            data[i+2] *= pulse;
        }
    },

    motionblur(data)
    {
        if(!previousFrame)
        {
            previousFrame = new Uint8ClampedArray(data);

            return;
        }

        for(let i=0; i<data.length; i+=4)
        {

            data[i] =
                data[i]*0.35 +
                previousFrame[i]*0.65;

            data[i+1] =
                data[i+1]*0.35 +
                previousFrame[i+1]*0.65;

            data[i+2] =
                data[i+2]*0.35 +
                previousFrame[i+2]*0.65;
        }

        previousFrame = new Uint8ClampedArray(data);
    },
    
    spiral(data,w,h)
    {
        const copy = new Uint8ClampedArray(data);

        const cx = w / 2;
        const cy = h / 2;

        const rotation = frame * 0.01;

        for (let y=0; y<h; y++)
        {
            for (let x=0; x<w; x++)
            {
                const dx = x - cx;
                const dy = y - cy;

                const dist = Math.sqrt(dx*dx + dy*dy);

                const angle =
                    Math.atan2(dy,dx) +
                    rotation +
                    dist * 0.002;

                const sx = Math.floor(
                    cx +
                    Math.cos(angle) * dist
                );

                const sy = Math.floor(
                    cy +
                    Math.sin(angle) * dist
                );

                if(
                    sx >= 0 &&
                    sx < w &&
                    sy >= 0 &&
                    sy < h
                ){

                    const src =
                        (sy*w + sx) * 4;

                    const dst =
                        (y*w + x) * 4;

                    data[dst]     = copy[src];
                    data[dst + 1] = copy[src + 1];
                    data[dst + 2] = copy[src + 2];
                }
            }
        }
    },

    rainbowpulse(data)
    {
        const t = frame * 0.03;

        for(let i=0; i<data.length; i+=4)
        {
            const lum =
                (data[i] +
                data[i+1] +
                data[i+2]) / 3;

            data[i] =
                128 +
                127 *
                Math.sin(
                    t +
                    lum * 0.02
                );

            data[i+1] =
                128 +
                127 *
                Math.sin(
                    t +
                    2 +
                    lum * 0.02
                );

            data[i+2] =
                128 +
                127 *
                Math.sin(
                    t +
                    4 +
                    lum * 0.02
                );
        }
    },

    liquid(data, w, h)
    {
        const copy = new Uint8ClampedArray(data);

        for (let y = 0; y < h; y++)
        {
            for (let x = 0; x < w; x++)
            {
                const sx = Math.max(
                    0,
                    Math.min(
                        w - 1,
                        x + Math.sin(y * 0.05 + frame * 0.05) * 5
                    )
                );

                const sy = Math.max(
                    0,
                    Math.min(
                        h - 1,
                        y + Math.cos(x * 0.05 + frame * 0.04) * 5
                    )
                );

                const src = ((sy | 0) * w + (sx | 0)) * 4;
                const dst = (y * w + x) * 4;

                data[dst]     = copy[src];
                data[dst + 1] = copy[src + 1];
                data[dst + 2] = copy[src + 2];
            }
        }
    },

    acid(data)
    {
        const offset = Math.floor(frame*2) & 255;

        for(let i=0; i<data.length; i+=4)
        {
            data[i] = acidLut[(data[i] + offset) & 255];

            data[i+1] = acidLut[(data[i+1] + offset + 50) & 255];

            data[i+2] = acidLut[(data[i+2] + offset + 100) & 255];
        }
    },

    kaleidoscope() {},

    feedback() {},

    raw(data)
    {
        const t = frame * 0.12;

        for (let i=0; i<data.length; i+=4)
        {
            const lum =
                data[i] * 0.3 +
                data[i+1] * 0.59 +
                data[i+2] * 0.11;

            const contrast =
                lum > 128
                ? 255
                : 0;

            const pulse =
                0.5 +
                0.5 *
                Math.sin(
                    t +
                    (i * 0.00001)
                );

            data[i] =
                contrast;

            data[i+1] =
                contrast * pulse;

            data[i+2] =
                contrast * 0.1;
        }
    },

    raw2(data,w)
    {
        const t = frame * 0.07;

        for(let i=0; i<data.length; i+=4)
        {
            const x =
                (i/4) % w;

            const y =
                Math.floor(
                    (i/4) / w
                );

            const lum =
                data[i] * 0.3 +
                data[i+1] * 0.59 +
                data[i+2] * 0.11;

            const threshold =
                128 +
                Math.sin(
                    x * 0.04 +
                    y * 0.04 +
                    t
                ) * 60;

            const value =
                lum > threshold
                ? 255
                : 0;

            data[i] =
                value;

            data[i+1] =
                value * 0.5;

            data[i+2] =
                value * 0.15;
        }
    },

    bounce(data, w, h)
    {
        const copy = new Uint8ClampedArray(data);

        const cx = w / 2;
        const cy = h / 2;

        const zoom =
            1.5 +
            Math.sin(frame * 0.03) * 0.15;

        for(let y = 0; y < h; y++)
        {
            for(let x = 0; x < w; x++)
            {
                const dx = x - cx;
                const dy = y - cy;

                const sx = Math.floor(
                    cx + dx / zoom
                );

                const sy = Math.floor(
                    cy + dy / zoom
                );

                if(
                    sx >= 0 &&
                    sx < w &&
                    sy >= 0 &&
                    sy < h
                )
                {
                    const src =
                        (sy * w + sx) * 4;

                    const dst =
                        (y * w + x) * 4;

                    data[dst]     = copy[src];
                    data[dst + 1] = copy[src + 1];
                    data[dst + 2] = copy[src + 2];
                }
            }
        }
    },

    fragment(data, w, h)
    {
        const copy = new Uint8ClampedArray(data);

        const cellSize = 40;

        for(let cy = 0; cy < h; cy += cellSize)
        {
            for(let cx = 0; cx < w; cx += cellSize)
            {
                const offsetX =
                    Math.floor(
                        Math.sin(
                            frame * 0.02 +
                            cx * 0.03
                        ) * 15
                    );

                const offsetY =
                    Math.floor(
                        Math.cos(
                            frame * 0.02 +
                            cy * 0.03
                        ) * 15
                    );

                for(let y = 0; y < cellSize; y++)
                {
                    for(let x = 0; x < cellSize; x++)
                    {
                        const srcX = Math.min(
                            w - 1,
                            Math.max(
                                0,
                                cx + x
                            )
                        );

                        const srcY = Math.min(
                            h - 1,
                            Math.max(
                                0,
                                cy + y
                            )
                        );

                        const dstX = Math.min(
                            w - 1,
                            Math.max(
                                0,
                                cx + x + offsetX
                            )
                        );

                        const dstY = Math.min(
                            h - 1,
                            Math.max(
                                0,
                                cy + y + offsetY
                            )
                        );

                        const src =
                            (srcY*w + srcX)*4;

                        const dst =
                            (dstY*w + dstX)*4;

                        data[dst]     = copy[src];
                        data[dst + 1] = copy[src + 1];
                        data[dst + 2] = copy[src + 2];
                    }
                }
            }
        }
    },

    fragment2(data, w, h)
    {
        const copy = new Uint8ClampedArray(data);

        const cellSize = 60;

        for (let cellY = 0; cellY < h; cellY += cellSize)
        {
            for(let cellX = 0; cellX < w; cellX += cellSize)
            {
                const angle =

                    Math.sin(
                        frame * 0.01 +
                        cellX * 0.015 +
                        cellY * 0.015
                    ) * Math.PI;

                const dx =
                    Math.cos(angle) * 20;

                const dy =
                    Math.sin(angle) * 20;

                for(let y = 0; y < cellSize; y++)
                {
                    for(let x = 0; x < cellSize; x++)
                    {
                        const srcX = cellX + x;
                        const srcY = cellY + y;

                        if(
                            srcX >= w ||
                            srcY >= h
                        ){
                            continue;
                        }

                        const dstX = Math.max(
                            0,
                            Math.min(
                                w - 1,
                                Math.floor(srcX + dx)
                            )
                        );

                        const dstY = Math.max(
                            0,
                            Math.min(
                                h - 1,
                                Math.floor(srcY + dy)
                            )
                        );

                        const src =
                            (srcY * w + srcX) * 4;

                        const dst =
                            (dstY * w + dstX) * 4;

                        data[dst]     = copy[src];
                        data[dst + 1] = copy[src + 1];
                        data[dst + 2] = copy[src + 2];
                    }
                }
            }
        }
    },

    ascii() {},

    pixelated(data, w, h)
    {
        const chars =
            " .:-=+*#%@";

        const cellSize = 8;

        for(let cy = 0; cy < h; cy += cellSize)
        {
            for(let cx = 0; cx < w; cx += cellSize)
            {
                let rSum = 0;
                let gSum = 0;
                let bSum = 0;
                let count = 0;

                for(let y = 0; y < cellSize; y++)
                {
                    for(let x = 0; x < cellSize; x++)
                    {
                        const px = cx + x;
                        const py = cy + y;

                        if(px >= w || py >= h)
                            continue;

                        const p =
                            (py * w + px) * 4;

                        rSum += data[p];
                        gSum += data[p + 1];
                        bSum += data[p + 2];

                        count++;
                    }
                }

                const r = rSum / count;
                const g = gSum / count;
                const b = bSum / count;

                const brightness =
                    (r + g + b) / 3;

                const charIndex =
                    Math.floor(
                        brightness / 255 *
                        (chars.length - 1)
                    );

                const factor =
                    charIndex /
                    (chars.length - 1);

                for(let y = 0; y < cellSize; y++)
                {
                    for(let x = 0; x < cellSize; x++)
                    {
                        const px = cx + x;
                        const py = cy + y;

                        if(px >= w || py >= h)
                            continue;

                        const p =
                            (py * w + px) * 4;

                        data[p]     = r * factor;
                        data[p + 1] = g * factor;
                        data[p + 2] = b * factor;
                    }
                }
            }
        }
    },

    fractal() {},

    wallblend() {},

    liquidborder(data,w,h)
    {
        const copy =
            new Uint8ClampedArray(data);

        for(let y=0; y<h; y++)
        {
            for(let x=0; x<w; x++)
            {
                const dist =
                    Math.min(
                        x,
                        y,
                        w-x,
                        h-y
                    );

                if(dist > 180)
                    continue;

                const strength =
                    1 - dist/180;

                const sx =
                    x +

                    Math.sin(
                        y*0.04 +
                        frame*0.08
                    ) * 25 * strength;

                const sy =
                    y +

                    Math.cos(
                        x*0.04 +
                        frame*0.08
                    ) * 25 * strength;

                const px =
                    Math.max(
                        0,
                        Math.min(
                            w-1,
                            sx|0
                        )
                    );

                const py =
                    Math.max(
                        0,
                        Math.min(
                            h-1,
                            sy|0
                        )
                    );

                const src =
                    (py*w+px)*4;

                const dst =
                    (y*w+x)*4;

                data[dst] =
                    copy[src];

                data[dst+1] =
                    copy[src+1];

                data[dst+2] =
                    copy[src+2];
            }
        }
    },
    
    crtcollapse(data,w,h)
    {
        const copy =
            new Uint8ClampedArray(data);

        const cx = w/2;
        const cy = h/2;

        for(let y=0; y<h; y++)
        {
            for(let x=0; x<w; x++)
            {
                const dist =
                    Math.min(
                        x,
                        y,
                        w-x,
                        h-y
                    );

                if(dist > 250)
                    continue;

                const amount =
                    (1-dist/250)*0.12;

                const sx =
                    cx +
                    (x-cx)*(1-amount);

                const sy =
                    cy +
                    (y-cy)*(1-amount);

                const src =
                    ((sy|0)*w+(sx|0))*4;

                const dst =
                    (y*w+x)*4;

                data[dst] =
                    copy[src];

                data[dst+1] =
                    copy[src+1];

                data[dst+2] =
                    copy[src+2];
            }
        }
    },
    
    neonhalo(data,w,h)
    {
        for(let y=0; y<h; y++)
        {
            for(let x=0; x<w; x++)
            {
                const dist =
                    Math.min(
                        x,
                        y,
                        w-x,
                        h-y
                    );

                if(dist > 150)
                    continue;

                const p =
                    (y*w+x)*4;

                const glow =
                    1 - dist/150;

                data[p] +=
                    glow * 60;

                data[p+1] +=
                    glow * 180;

                data[p+2] +=
                    glow * 255;
            }
        }
    },
    
    fovmax(data,w,h)
    {
        const copy =
            new Uint8ClampedArray(data);

        const cx = w/2;
        const cy = h/2;

        for(let y=0; y<h; y++)
        {
            for(let x=0; x<w; x++)
            {
                const edge =
                    Math.min(
                        x,
                        y,
                        w-x,
                        h-y
                    );

                if(edge > 200)
                    continue;

                const force =
                    (1-edge/200)*0.25;

                const sx =
                    x +
                    (cx-x)*force;

                const sy =
                    y +
                    (cy-y)*force;

                const src =
                    ((sy|0)*w+(sx|0))*4;

                const dst =
                    (y*w+x)*4;

                data[dst] =
                    copy[src];

                data[dst+1] =
                    copy[src+1];

                data[dst+2] =
                    copy[src+2];
            }
        }
    },
    
    pixeldissolve(data, w, h)
    {
        const copy = new Uint8ClampedArray(data);

        const maxBlock = 24;
        const edgeSize = 250;

        for(let y = 0; y < h; y++)
        {
            for(let x = 0; x < w; x++)
            {
                const dist =
                    Math.min(
                        x,
                        y,
                        w - x - 1,
                        h - y - 1
                    );

                if(dist > edgeSize)
                    continue;

                const edge =
                    1 - dist / edgeSize;

                const blockSize =
                    Math.max(
                        1,
                        Math.floor(
                            1 + edge * maxBlock
                        )
                    );

                const sx =
                    Math.floor(x / blockSize) *
                    blockSize;

                const sy =
                    Math.floor(y / blockSize) *
                    blockSize;

                const src =
                    (sy * w + sx) * 4;

                const dst =
                    (y * w + x) * 4;

                data[dst]     = copy[src];
                data[dst + 1] = copy[src + 1];
                data[dst + 2] = copy[src + 2];
            }
        }
    },
    
    glitch2(data, w, h)
    {
        const copy =
            new Uint8ClampedArray(data);

        const blocks = 40;

        for(let b = 0; b < blocks; b++)
        {
            const blockW =
                20 +
                Math.random() * 100;

            const blockH =
                10 +
                Math.random() * 60;

            const srcX =
                Math.floor(
                    Math.random() *
                    (w - blockW)
                );

            const srcY =
                Math.floor(
                    Math.random() *
                    (h - blockH)
                );

            const dstX =
                Math.floor(
                    srcX +
                    (Math.random() - 0.5) * 300
                );

            const dstY =
                Math.floor(
                    srcY +
                    (Math.random() - 0.5) * 150
                );

            for(let y = 0; y < blockH; y++)
            {
                const sy = srcY + y;
                const dy = dstY + y;

                if(
                    dy < 0 ||
                    dy >= h
                )
                    continue;

                for(let x = 0; x < blockW; x++)
                {
                    const sx = srcX + x;
                    const dx = dstX + x;

                    if(
                        dx < 0 ||
                        dx >= w
                    )
                        continue;

                    const src =
                        (sy * w + sx) * 4;

                    const dst =
                        (dy * w + dx) * 4;

                    data[dst] =
                        copy[src];

                    data[dst+1] =
                        copy[src+1];

                    data[dst+2] =
                        copy[src+2];
                }
            }
        }

        for(let i = 0; i < data.length; i += 4)
        {
            if(Math.random() < 0.002)
            {
                data[i] =
                    Math.random() * 255;

                data[i+1] =
                    Math.random() * 255;

                data[i+2] =
                    Math.random() * 255;
            }
        }
    },
    
    colorful(data)
    {
        const t = frame * 0.02;

        for(let i = 0; i < data.length; i += 4)
        {
            const lum =

                data[i] * 0.299 +

                data[i+1] * 0.587 +

                data[i+2] * 0.114;

            data[i] =
                lum *
                (
                    0.7 +
                    0.3 *
                    Math.sin(
                        t
                    )
                );

            data[i+1] =
                lum *
                (
                    0.7 +
                    0.3 *
                    Math.sin(
                        t + 2
                    )
                );

            data[i+2] =
                lum *
                (
                    0.7 +
                    0.3 *
                    Math.sin(
                        t + 4
                    )
                );
        }
    },

    beatshake(data,w,h)
    {
        const copy = new Uint8ClampedArray(data);

        const amount =
            Math.floor(
                30 * Math.pow(
                    Math.sin(beatPhase * Math.PI),
                    2
                )
            );

        for(let y=0;y<h;y++)
        {
            for(let x=amount;x<w-amount;x++)
            {
                const p = (y*w+x)*4;

                const pr =
                    (y*w+(x-amount))*4;

                const pb =
                    (y*w+(x+amount))*4;

                data[p] =
                    copy[pr];

                data[p+2] =
                    copy[pb+2];
            }
        }
    },
    beatsolar(data)
    {
        const pulse =
            Math.sin(
                beatPhase*Math.PI
            );

        const threshold =
            80 +
            pulse * 140;

        for(let i=0;i<data.length;i+=4)
        {
            const lum =
                (
                    data[i] +
                    data[i+1] +
                    data[i+2]
                )/3;

            if(lum > threshold)
            {
                data[i]   = 255-data[i];
                data[i+1] = 255-data[i+1];
                data[i+2] = 255-data[i+2];
            }
        }
    },kickzoom(data, w, h)
{
    const copy = new Uint8ClampedArray(data);

    const cx = w / 2;
    const cy = h / 2;

    const pulse =
        Math.pow(
            Math.sin(beatPhase * Math.PI),
            5
        );

    const zoom =
        1 + pulse * 0.5;

    for(let y = 0; y < h; y++)
    {
        for(let x = 0; x < w; x++)
        {
            const dx = x - cx;
            const dy = y - cy;

            const sx = Math.floor(
                cx + dx / zoom
            );

            const sy = Math.floor(
                cy + dy / zoom
            );

            if(
                sx >= 0 &&
                sx < w &&
                sy >= 0 &&
                sy < h
            )
            {
                const src =
                    (sy * w + sx) * 4;

                const dst =
                    (y * w + x) * 4;

                data[dst]     = copy[src];
                data[dst + 1] = copy[src + 1];
                data[dst + 2] = copy[src + 2];
            }
        }
    }
},crush(data, w, h)
{
    const copy =
        new Uint8ClampedArray(data);

    const pulse =
        Math.sin(
            beatPhase * Math.PI
        );

    const blockSize =
        2 +
        Math.floor(
            pulse * 10
        );

    for(let y = 0; y < h; y++)
    {
        for(let x = 0; x < w; x++)
        {
            const sx =
                Math.floor(x / blockSize) *
                blockSize;

            const sy =
                Math.floor(y / blockSize) *
                blockSize;

            const src =
                (sy * w + sx) * 4;

            const dst =
                (y * w + x) * 4;

            data[dst]     = copy[src];
            data[dst + 1] = copy[src + 1];
            data[dst + 2] = copy[src + 2];
        }
    }
},vortex(data, w, h)
{
    const copy =
        new Uint8ClampedArray(data);

    const cx = w * 0.5;
    const cy = h * 0.5;

    const pulse =
        Math.pow(
            Math.sin(
                beatPhase * Math.PI
            ),
            2
        );

    const rotation =
        pulse * 0.7;

    for(let y = 0; y < h; y++)
    {
        for(let x = 0; x < w; x++)
        {
            const dx = x - cx;
            const dy = y - cy;

            const dist =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );

            const angle =
                Math.atan2(dy, dx) +
                rotation *
                (1 - dist / Math.max(w, h));

            const sx =
                Math.floor(
                    cx +
                    Math.cos(angle) *
                    dist
                );

            const sy =
                Math.floor(
                    cy +
                    Math.sin(angle) *
                    dist
                );

            if(
                sx >= 0 &&
                sx < w &&
                sy >= 0 &&
                sy < h
            )
            {
                const src =
                    (sy * w + sx) * 4;

                const dst =
                    (y * w + x) * 4;

                data[dst]     = copy[src];
                data[dst + 1] = copy[src + 1];
                data[dst + 2] = copy[src + 2];
            }
        }
    }
},
}

function wallBlend()
{
    const mask = document.createElement("canvas");

    mask.width = canvas.width;
    mask.height = canvas.height;

    const mctx = mask.getContext("2d");

    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;

    const radius =
        Math.min(
            canvas.width,
            canvas.height
        ) * 0.42;

    mctx.fillStyle = "white";

    mctx.beginPath();

    for(let a = 0; a <= Math.PI * 2; a += 0.02)
    {
        const wave =
            Math.sin(a * 5 + frame * 0.03) * 40 +
            Math.sin(a * 11 - frame * 0.02) * 25 +
            Math.sin(a * 23 + frame * 0.01) * 15;

        const r =
            radius + wave;

        const x =
            cx + Math.cos(a) * r;

        const y =
            cy + Math.sin(a) * r;

        if(a === 0)
            mctx.moveTo(x, y);
        else
            mctx.lineTo(x, y);
    }

    mctx.closePath();
    mctx.fill();

    ctx.save();

ctx.translate(
    canvas.width / 2,
    canvas.height / 2
);

ctx.rotate(Math.PI / 3);

ctx.drawImage(
    source,
    -canvas.height / 2,
    -canvas.width / 2,
    canvas.height,
    canvas.width
);

ctx.restore();
}

function createButtons()
{

    Object.keys(effectProcessors).forEach(effect=>
    {

        const btn = document.createElement("button");

        btn.className="fx-btn";
        btn.textContent=effect;

        btn.addEventListener("click",()=>
        {

            if(activeEffects.has(effect))
            {
                effects.disable(effect);
                btn.classList.remove("active");
            }
            else
            {
                effects.enable(effect);
                btn.classList.add("active");
            }
        });

        effectsBar.appendChild(btn);
    });

    const breakLine = document.createElement("div");
    breakLine.className = "line-break";

    effectsBar.appendChild(breakLine);

    const resetButton = document.createElement("button");

    resetButton.className="fx-btn";
    resetButton.textContent="reset";

    resetButton.addEventListener("click",()=>
    {

        activeEffects.clear();

        document
            .querySelectorAll(".fx-btn")
            .forEach(btn=>btn.classList.remove("active"));
    });

    effectsBar.appendChild(resetButton);

    const colorPicker = document.createElement("input");

    colorPicker.type = "color";
    colorPicker.id = "colorFilterPicker";
    colorPicker.value = "#ff00ff";

    effectsBar.appendChild(colorPicker);

    colorPicker.addEventListener("input", (e)=>
    {
        colorFilter = e.target.value;
    });

    const fitButton = document.createElement("button");

    fitButton.className = "fx-btn";
    fitButton.textContent = "contain";
    fitButton.style.color = "gold";

    fitButton.addEventListener("click",()=>
    {
        if(fitMode === "contain")
        {
            fitMode = "cover";
            fitButton.textContent = "cover";
        }
        else
        {
            fitMode = "contain";
            fitButton.textContent = "contain";
        }
    });

    //effectsBar.appendChild(fitButton);

    const modeButton = document.createElement("button");

    modeButton.className = "fx-btn";
    modeButton.textContent = "auto";
    modeButton.style.color = "gold";

    modeButton.addEventListener("click",()=>
    {
        if(mode === "auto")
        {
            mode = "auto";
            modeButton.textContent = "manual";
        }
        else
        {
            mode = "manual";
            modeButton.textContent = "auto";
        }

        modeManager();
    });

    effectsBar.appendChild(modeButton);

    const flipXButton = document.createElement("button");

    flipXButton.className = "fx-btn";
    flipXButton.textContent = "flip x ";

    flipXButton.addEventListener("click",()=>
    {

        flipX = !flipX;

        flipXButton.classList.toggle(
            "active",
            flipX
        );
    });

    effectsBar.appendChild(flipXButton);

    const flipYButton = document.createElement("button");

    flipYButton.className = "fx-btn";
    flipYButton.textContent = "flip y";

    flipYButton.addEventListener("click",()=>
    {

        flipY = !flipY;

        flipYButton.classList.toggle(
            "active",
            flipY
        );
    });

    effectsBar.appendChild(flipYButton);
}

createButtons();

document.addEventListener("pointermove",(e)=>
{
    if (e.pointerType == "touch") return;
    if(e.clientY > window.innerHeight - effectsBar.clientHeight && e.clientY < window.innerHeight-10)
        effectsBar.classList.add("visible");
    else
        effectsBar.classList.remove("visible");
});

function startRecording()
{
    const stream = video.srcObject;//canvas.captureStream(30);

    recordedChunks = [];

    mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9"
    });

    mediaRecorder.ondataavailable = (event) =>
    {
        if(event.data.size > 0)
            recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () =>
    {
        const blob = new Blob(
            recordedChunks,
            { type: "video/webm" }
        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;
        a.download =
            `recording_${Date.now()}.webm`;

        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);

        console.log("Vidéo sauvegardée");
    };

    mediaRecorder.start();

    isRecording = true;

    console.log("Enregistrement démarré");
}

function stopRecording()
{
    if(
        mediaRecorder &&
        mediaRecorder.state !== "inactive"
    )
    {
        mediaRecorder.stop();

        isRecording = false;

        console.log("Enregistrement arrêté");
    }
}

function render(){

    frame++;

    const source =
        useMjpeg
            ? mjpegStream
            : video;

    const sourceWidth =
        useMjpeg
            ? mjpegStream.naturalWidth
            : video.videoWidth;

    const sourceHeight =
        useMjpeg
            ? mjpegStream.naturalHeight
            : video.videoHeight;

    if(
        !source ||
        !sourceWidth ||
        !sourceHeight
    ){
        requestAnimationFrame(render);
        return;
    }

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const sourceRatio =
        sourceWidth / sourceHeight;

    const canvasRatio =
        canvas.width / canvas.height;

    let drawWidth;
    let drawHeight;
    let offsetX;
    let offsetY;

    if(fitMode === "contain"){

        if(sourceRatio > canvasRatio){

            drawWidth = canvas.width;
            drawHeight =
                drawWidth / sourceRatio;

        }else{

            drawHeight = canvas.height;
            drawWidth =
                drawHeight * sourceRatio;
        }

    }else{

        if(sourceRatio > canvasRatio){

            drawHeight = canvas.height;
            drawWidth =
                drawHeight * sourceRatio;

        }else{

            drawWidth = canvas.width;
            drawHeight =
                drawWidth / sourceRatio;
        }
    }

    offsetX =
        (canvas.width - drawWidth) / 2;

    offsetY =
        (canvas.height - drawHeight) / 2;

ctx.save();

if(flipX || flipY){

    ctx.translate(
        canvas.width / 2,
        canvas.height / 2
    );

    ctx.scale(
        flipX ? -1 : 1,
        flipY ? -1 : 1
    );

    ctx.translate(
        -canvas.width / 2,
        -canvas.height / 2
    );
}

ctx.drawImage(
    source,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
);

ctx.restore();

    const imageData =
        ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );

    const data =
        imageData.data;

    activeEffects.forEach(effect => {

        if(effect === "kaleidoscope"){
            return;
        }

        const processor =
            effectProcessors[effect];

        if(processor){

            processor(
                data,
                canvas.width,
                canvas.height
            );
        }
    });

    if(colorFilter){

        const c = hexToRgb(colorFilter);

        for(let i=0;i<data.length;i+=4){

            data[i] =
                data[i] *
                (c.r / 255);

            data[i+1] =
                data[i+1] *
                (c.g / 255);

            data[i+2] =
                data[i+2] *
                (c.b / 255);
        }
    }

    ctx.putImageData(
        imageData,
        0,
        0
    );

    if(activeEffects.has("kaleidoscope")){

        const temp = document.createElement("canvas");

        temp.width = canvas.width;
        temp.height = canvas.height;

        const tctx = temp.getContext("2d");

        tctx.drawImage(
            canvas,
            0,
            0
        );

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        const segments = kaleidoSegments;

        for(let i=0;i<segments;i++){

            ctx.save();

            ctx.translate(cx,cy);

            ctx.rotate(

                i *
                Math.PI * 2 /
                segments

                +

                frame * 0.005

            );

            if(i % 2){
                ctx.scale(-1,1);
            }

            ctx.beginPath();

            ctx.moveTo(0,0);

            const a =
                Math.PI * 2 / segments;

            ctx.lineTo(
                Math.cos(-a/2) * 2000,
                Math.sin(-a/2) * 2000
            );

            ctx.lineTo(
                Math.cos(a/2) * 2000,
                Math.sin(a/2) * 2000
            );

            ctx.closePath();

            ctx.clip();

            ctx.drawImage(
                temp,
                -cx,
                -cy
            );

            ctx.restore();
        }
    }
    
    if (activeEffects.has("feedback"))
    {

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        ctx.save();

        ctx.globalAlpha = 0.25;

        feedbackAngle += 0.0004;

        const zoom =
            1.006 +
            Math.sin(frame * 0.0015) * 0.003;

        const offsetX =
            Math.sin(frame * 0.0012) * 25;

        const offsetY =
            Math.cos(frame * 0.0018) * 20;

        ctx.translate(
            cx + offsetX,
            cy + offsetY
        );

        ctx.rotate(feedbackAngle);

        ctx.scale(
            zoom,
            zoom
        );

        ctx.drawImage(
            feedbackCanvas,
            -cx,
            -cy
        );

        ctx.restore();
    }

    if(activeEffects.has("ascii"))
    {
        const chars =
            "@%#*+=-:. ";

        const step = 8;

        const img =
            ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );

        ctx.fillStyle = "black";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        ctx.fillStyle = "white";
        ctx.font =
            `${step}px monospace`;

        for(let y=0; y<canvas.height; y+=step)
        {
            for(let x=0; x<canvas.width; x+=step)
            {
                const p =
                    (y * canvas.width + x) * 4;

                const lum =
                    (
                        img.data[p] +
                        img.data[p+1] +
                        img.data[p+2]
                    ) / 3;

                const index =
                    Math.floor(
                        lum / 255 *
                        (chars.length - 1)
                    );

                ctx.fillText(
                    chars[index],
                    x,
                    y
                );
            }
        }
    }

    if(activeEffects.has("fractal"))
    {
        const temp = document.createElement("canvas");

        temp.width = canvas.width;
        temp.height = canvas.height;

        const tctx =
            temp.getContext("2d");

        tctx.drawImage(canvas, 0, 0);

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        for(let i = 0; i < 12; i++)
        {
            const s =
                Math.pow(0.75, i);

            ctx.save();

            ctx.translate(cx, cy);

            ctx.rotate(
                frame * 0.002 +
                i * 0.15
            );

            ctx.scale(s, s);

            ctx.translate(-cx, -cy);

            ctx.globalAlpha =
                0.9 - i * 0.06;

            ctx.drawImage(
                temp,
                0,
                0
            );

            ctx.restore();
        }
    }

    if(activeEffects.has("wallblend"))
        wallBlend();

    feedbackCtx.clearRect(
        0,
        0,
        feedbackCanvas.width,
        feedbackCanvas.height
    );

    feedbackCtx.drawImage(
        canvas,
        0,
        0
    );

    wallCtx.clearRect(
    0,
    0,
    wallCanvas.width,
    wallCanvas.height
    );

    wallCtx.drawImage(
        canvas,
        0,
        0
    );

    requestAnimationFrame(render);
}

video.addEventListener("playing",render);

document.addEventListener("keydown", (event) =>
{
    if(event.code !== "Space")
        return;

    event.preventDefault();

    if(!isRecording)
        startRecording();
    else
        stopRecording();
});

console.log("FX disponibles :");
effects.list();

let bpm = 120;
let lastTapTime = 0;
let beatPhase = 0.;

function updateBeatPhase() 
{
    const now = performance.now();

    const beatDuration = 60000 / bpm;

    beatPhase =
        ((now - lastTapTime) % beatDuration) /
        beatDuration;

    requestAnimationFrame(updateBeatPhase);
}

updateBeatPhase();