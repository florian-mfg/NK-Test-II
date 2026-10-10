exports.recordMP4 = async (page, width = 160, height = 90) => {
  const encoded = await page.evaluate(async ({width,height}) => {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d'),stream=canvas.captureStream(20),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/mp4'});
    recorder.ondataavailable=event=>chunks.push(event.data);
    const done=new Promise(resolve=>recorder.onstop=resolve);
    recorder.start();
    const timer=setInterval(()=>{context.fillStyle='#555';context.fillRect(0,0,width,height);},40);
    await new Promise(resolve=>setTimeout(resolve,600));recorder.stop();await done;
    clearInterval(timer);stream.getTracks().forEach(track=>track.stop());
    return btoa(String.fromCharCode(...new Uint8Array(await new Blob(chunks).arrayBuffer())));
  },{width,height});
  return Buffer.from(encoded,'base64');
};
