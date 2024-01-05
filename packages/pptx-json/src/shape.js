import { getTextByPathList } from './utils'

export function shapeArc(cX, cY, rX, rY, stAng, endAng, isClose) {
  let dData
  let angle = stAng
  if (endAng >= stAng) {
    while (angle <= endAng) {
      const radians = angle * (Math.PI / 180)
      const x = cX + Math.cos(radians) * rX
      const y = cY + Math.sin(radians) * rY
      if (angle === stAng) {
        dData = ' M' + x + ' ' + y
      }
      dData += ' L' + x + ' ' + y
      angle++
    }
  } 
  else {
    while (angle > endAng) {
      const radians = angle * (Math.PI / 180)
      const x = cX + Math.cos(radians) * rX
      const y = cY + Math.sin(radians) * rY
      if (angle === stAng) {
        dData = ' M ' + x + ' ' + y
      }
      dData += ' L ' + x + ' ' + y
      angle--
    }
  }
  dData += (isClose ? ' z' : '')
  return dData
}

export function getCustomShapePath(custShapType, w, h) {
  const pathLstNode = getTextByPathList(custShapType, ['a:pathLst'])
  const pathNodes = getTextByPathList(pathLstNode, ['a:path'])
  const maxX = parseInt(pathNodes['attrs']['w'])
  const maxY = parseInt(pathNodes['attrs']['h'])
  const cX = (1 / maxX) * w
  const cY = (1 / maxY) * h
  let d = ''

  let moveToNode = getTextByPathList(pathNodes, ['a:moveTo'])

  const lnToNodes = pathNodes['a:lnTo']
  let cubicBezToNodes = pathNodes['a:cubicBezTo']
  const arcToNodes = pathNodes['a:arcTo']
  let closeNode = getTextByPathList(pathNodes, ['a:close'])
  if (!Array.isArray(moveToNode)) moveToNode = [moveToNode]

  const multiSapeAry = []
  if (moveToNode.length > 0) {
    Object.keys(moveToNode).forEach(key => {
      const moveToPtNode = moveToNode[key]['a:pt']
      if (moveToPtNode) {
        Object.keys(moveToPtNode).forEach(key => {
          const moveToNoPt = moveToPtNode[key]
          const spX = moveToNoPt['attrs', 'x']
          const spY = moveToNoPt['attrs', 'y']
          const order = moveToNoPt['attrs', 'order']
          multiSapeAry.push({
            type: 'movto',
            x: spX,
            y: spY,
            order,
          })
        })
      }
    })
    if (lnToNodes) {
      Object.keys(lnToNodes).forEach(key => {
        const lnToPtNode = lnToNodes[key]['a:pt']
        if (lnToPtNode) {
          Object.keys(lnToPtNode).forEach(key => {
            const lnToNoPt = lnToPtNode[key]
            const ptX = lnToNoPt['attrs', 'x']
            const ptY = lnToNoPt['attrs', 'y']
            const order = lnToNoPt['attrs', 'order']
            multiSapeAry.push({
              type: 'lnto',
              x: ptX,
              y: ptY,
              order,
            })
          })
        }
      })
    }
    if (cubicBezToNodes) {
      const cubicBezToPtNodesAry = []
      if (!Array.isArray(cubicBezToNodes)) {
        cubicBezToNodes = [cubicBezToNodes]
      }
      Object.keys(cubicBezToNodes).forEach(key => {
        cubicBezToPtNodesAry.push(cubicBezToNodes[key]['a:pt'])
      })

      cubicBezToPtNodesAry.forEach(key => {
        const pts_ary = []
        key.forEach(pt => {
          const pt_obj = {
            x: pt['attrs']['x'],
            y: pt['attrs']['y'],
          }
          pts_ary.push(pt_obj)
        })
        const order = key[0]['attrs']['order']
        multiSapeAry.push({
          type: 'cubicBezTo',
          cubBzPt: pts_ary,
          order,
        })
      })
    }
    if (arcToNodes) {
      const arcToNodesAttrs = arcToNodes['attrs']
      const order = arcToNodesAttrs['order']
      const hR = arcToNodesAttrs['hR']
      const wR = arcToNodesAttrs['wR']
      const stAng = arcToNodesAttrs['stAng']
      const swAng = arcToNodesAttrs['swAng']
      let shftX = 0
      let shftY = 0
      const arcToPtNode = getTextByPathList(arcToNodes, ['a:pt', 'attrs'])
      if (arcToPtNode) {
        shftX = arcToPtNode['x']
        shftY = arcToPtNode['y']
      }
      multiSapeAry.push({
        type: 'arcTo',
        hR: hR,
        wR: wR,
        stAng: stAng,
        swAng: swAng,
        shftX: shftX,
        shftY: shftY,
        order,
      })
    }
    if (closeNode) {
      if (!Array.isArray(closeNode)) closeNode = [closeNode]
      Object.keys(closeNode).forEach(() => {
        multiSapeAry.push({
          type: 'close',
          order: Infinity,
        })
      })
    }

    multiSapeAry.sort((a, b) => a.order - b.order)

    let k = 0
    while (k < multiSapeAry.length) {
      if (multiSapeAry[k].type === 'movto') {
        const spX = parseInt(multiSapeAry[k].x) * cX
        const spY = parseInt(multiSapeAry[k].y) * cY
        d += ' M' + spX + ',' + spY
      } 
      else if (multiSapeAry[k].type === 'lnto') {
        const Lx = parseInt(multiSapeAry[k].x) * cX
        const Ly = parseInt(multiSapeAry[k].y) * cY
        d += ' L' + Lx + ',' + Ly
      } 
      else if (multiSapeAry[k].type === 'cubicBezTo') {
        const Cx1 = parseInt(multiSapeAry[k].cubBzPt[0].x) * cX
        const Cy1 = parseInt(multiSapeAry[k].cubBzPt[0].y) * cY
        const Cx2 = parseInt(multiSapeAry[k].cubBzPt[1].x) * cX
        const Cy2 = parseInt(multiSapeAry[k].cubBzPt[1].y) * cY
        const Cx3 = parseInt(multiSapeAry[k].cubBzPt[2].x) * cX
        const Cy3 = parseInt(multiSapeAry[k].cubBzPt[2].y) * cY
        d += ' C' + Cx1 + ',' + Cy1 + ' ' + Cx2 + ',' + Cy2 + ' ' + Cx3 + ',' + Cy3
      } 
      else if (multiSapeAry[k].type === 'arcTo') {
        const hR = parseInt(multiSapeAry[k].hR) * cX
        const wR = parseInt(multiSapeAry[k].wR) * cY
        const stAng = parseInt(multiSapeAry[k].stAng) / 60000
        const swAng = parseInt(multiSapeAry[k].swAng) / 60000
        const endAng = stAng + swAng
        d += shapeArc(wR, hR, wR, hR, stAng, endAng, false)
      }
      else if (multiSapeAry[k].type === 'close') d += 'z'
      k++
    }
  }

  return d
}