import { getHorizontalAlign } from "./align";
import { getTextByPathList } from "./utils";

import { getFontType, getFontColor, getFontSize, getFontBold, getFontItalic, getFontDecoration, getFontDecorationLine, getFontSpace, getFontSubscript, getFontShadow } from "./fontStyle";

export function genTextBody(textBodyNode, slideLayoutSpNode, slideMasterSpNode, type, warpObj, fontsizeFactor, slideFactor, textBodySpPr) {
  if (!textBodyNode) return "";

  const slideMasterTextStyles = warpObj["slideMasterTextStyles"];

  const pNode = textBodyNode["a:p"];
  const pNodes = pNode.constructor === Array ? pNode : [pNode];

  let styles = [];

  for (const pNode of pNodes) {
    let rNode = pNode["a:r"];
    let fldNode = pNode["a:fld"];
    let brNode = pNode["a:br"];
    if (rNode) {
      rNode = rNode.constructor === Array ? rNode : [rNode];

      if (fldNode) {
        fldNode = fldNode.constructor === Array ? fldNode : [fldNode];
        rNode = rNode.concat(fldNode);
      }
      if (brNode) {
        brNode = brNode.constructor === Array ? brNode : [brNode];
        brNode.forEach((item) => (item.type = "br"));

        if (brNode.length > 1) brNode.shift();
        rNode = rNode.concat(brNode);
        rNode.sort((a, b) => {
          if (!a.attrs || !b.attrs) return true;
          return a.attrs.order - b.attrs.order;
        });
      }
    }
    const align = getHorizontalAlign(pNode, slideLayoutSpNode, slideMasterSpNode, type, slideMasterTextStyles);
    // const listType = getListType(pNode);
    if (!rNode) {
      const result = genSpanElement(pNode, slideLayoutSpNode, type, warpObj, fontsizeFactor, slideFactor, textBodySpPr);
      result.align = align;
      styles.push(result);
    } else {
      let newStyles = [];
      for (const rNodeItem of rNode) {
        newStyles.push(genSpanElement(rNodeItem, slideLayoutSpNode, type, warpObj, fontsizeFactor, slideFactor, textBodySpPr));
      }
      let resultText = "";
      newStyles.forEach((item) => {
        resultText += item.text;
      });
      newStyles[0].text = resultText;
      newStyles[0].align = align;
      styles.push(newStyles[0]);
    }
  }
  if (styles.length > 1) {
    const newText = styles.reduce((now, next) => {
      now += next.text + "\n";
      return now;
    }, "");
    styles[0].text = newText;
    return styles[0];
  }
  return styles[0];
}

export function getListType(node) {
  const pPrNode = node["a:pPr"];
  if (!pPrNode) return "";

  if (pPrNode["a:buChar"]) return "ul";
  if (pPrNode["a:buAutoNum"]) return "ol";

  return "";
}

export function genSpanElement(node, slideLayoutSpNode, type, warpObj, fontsizeFactor, slideFactor) {
  const slideMasterTextStyles = warpObj["slideMasterTextStyles"];
  let text = node["a:t"];
  if (typeof text !== "string") text = getTextByPathList(node, ["a:fld", "a:t"]);
  if (typeof text !== "string") text = "&nbsp;";

  let styleText = {};
  const fontColor = getFontColor(node);
  const fontSize = getFontSize(node, slideLayoutSpNode, type, slideMasterTextStyles, fontsizeFactor);
  const fontType = getFontType(node, type, warpObj);
  const fontBold = getFontBold(node);
  const fontItalic = getFontItalic(node);
  const fontDecoration = getFontDecoration(node);
  const fontDecorationLine = getFontDecorationLine(node);
  const fontSpace = getFontSpace(node, fontsizeFactor);
  const shadow = getFontShadow(node, warpObj, slideFactor);
  const subscript = getFontSubscript(node);

  if (fontColor) styleText.fontColor = fontColor;
  if (fontSize) styleText.fontSize = fontSize;
  if (fontType) styleText.fontType = fontType;
  if (fontBold) styleText.fontBold = fontBold;
  if (fontItalic) styleText.fontItalic = fontItalic;
  if (fontDecoration) styleText.fontDecoration = fontDecoration;
  if (fontDecorationLine) styleText.fontDecorationLine = fontDecorationLine;
  if (fontSpace) styleText.fontSpace = fontSpace;
  if (subscript) styleText.subscript = subscript;
  if (shadow) styleText["text-shadow"] = shadow;
  styleText.text = text;

  // const linkID = getTextByPathList(node, ["a:rPr", "a:hlinkClick", "attrs", "r:id"]);
  // if (linkID) {
  //   const linkURL = warpObj["slideResObj"][linkID]["target"];
  //   return `<span style="${styleText}"><a href="${linkURL}" target="_blank">${text.replace(/\s/i, "&nbsp;")}</a></span>`;
  // }
  return styleText;
}
