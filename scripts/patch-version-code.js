const fs = require('fs');

function analyzeAndPatch(manifestBuf, newVersionCode) {
  let pos = 0;
  let manifestTagPos = -1;
  while (pos < manifestBuf.length - 8) {
    if (manifestBuf.readUInt16LE(pos) === 0x0102) {
      manifestTagPos = pos;
      break;
    }
    pos += 2;
  }
  
  if (manifestTagPos === -1) {
    throw new Error('Manifest start element tag not found!');
  }

  const attrStartRel = manifestBuf.readUInt16LE(manifestTagPos + 24);
  const attrSize = manifestBuf.readUInt16LE(manifestTagPos + 26);
  const attrCount = manifestBuf.readUInt16LE(manifestTagPos + 28);
  console.log(`Manifest tag at ${manifestTagPos}, attrStartRel: ${attrStartRel}, attrSize: ${attrSize}, attrCount: ${attrCount}`);

  const attrBase = manifestTagPos + 16 + attrStartRel;

  for (let i = 0; i < attrCount; i++) {
    const curAttr = attrBase + i * attrSize;
    const dataType = manifestBuf.readUInt8(curAttr + 15);
    const dataVal = manifestBuf.readInt32LE(curAttr + 16);
    console.log(`Attr ${i} at ${curAttr}: type 0x${dataType.toString(16)}, value: ${dataVal}`);
    
    // type 0x10 is TYPE_INT_DEC
    if (dataType === 0x10) {
      console.log(`Found int attribute at ${curAttr + 16} with value ${dataVal}, changing to ${newVersionCode}`);
      manifestBuf.writeInt32LE(newVersionCode, curAttr + 16);
      return manifestBuf;
    }
  }
  
  throw new Error('versionCode attribute not found');
}

module.exports = { analyzeAndPatch };
