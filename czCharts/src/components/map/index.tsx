import { Button, Steps } from 'antd'
import React, { FC, useEffect, useState } from 'react'
import * as d3 from 'd3'
import './index.scss'
import clickcancel from '@/utils/cancelableClick'
import _, { last } from 'lodash'
import Heatmap from '@/utils/heatmap'

const Legend: FC = ({ mapColor, text, rangeColor }) => {
  return (
    <div className="legend">
      <ul>
        {
          rangeColor ? 
          rangeColor.map((i, index) => {
            return <li key={index}><span style={{background: i}}></span>{i}</li>
          })
          :
          mapColor.map((i, index) => {
            return <li key={index}><span style={{background: i}}></span>{text[index]}</li>
          })
        }
      </ul>
    </div>
  )
}

const HeatMap: FC = ({ projection, heatmapConfig }) => {
  const { points, config } = heatmapConfig

  const transPoints = () => {
    const valueArr = []
    const arr = points.map((i) => {
      const { x, y, value } = i
      const [x1, y1] = projection([x, y])
      valueArr.push(value)
      return {
        // floats are not supported in heatmap.js
        // issues: https://github.com/pa7/heatmap.js/issues/260
        x: parseInt(x1),
        y: parseInt(y1),
        value
      }
    })
    return { arr, max: Math.max(...valueArr) }
  }

  const addHeatMap = () => {
    // 创建一个heatmap实例对象
    const heatmapInstance = Heatmap.create({
      container: document.getElementById('heatmap'),
      ...config
    })
    const { max, arr } = transPoints()
    const data = { max, data: arr }
    // 因为data是一组数据,所以直接setData
    heatmapInstance.setData(data)
  }

  useEffect(() => {
    addHeatMap()
  }, [])

  return (
    <div id="heatmap" className='heatmap' xmlns="http://www.w3.org/1999/xhtml"></div>
  )
}

let _id = 0
let shapeArr = []
 /*
  * historyi用Map结构的原因是Map有顺序，普通对象无序（详见back方法2021-12-23的注释）
  * 本来想的是直接取historyi的最后一个，后来发现，不能直接取最后一个（详见back方法2021-12-08跟2021-12-27的注释）
  * 后来添加了操作日志stepArr后，就用不到顺序的特性了，所以Map结构跟普通对象结构都行
  */
let historyi = new Map()
let stepArr = []

let shouldAppear = false
let shaper = {}
let isDraw = false

let mousestart = []
let start = []

// 0: rect, 1: circle, 2: polygon
let drawType = [false, false, false]

// polygon的坐标点存储
let msPoints = []
let points = []

let transArr = []

const Mapr: FC = ({
  data, haslegend, legend,
  hoverStyle, afterDraw, onClick,
  hasHeatMap, heatmapConfig, transData,
  shapeData
}) => {
  const [popData, setPopData] = useState({ name: '', value: ''})
  
  if (haslegend && !legend) {
    throw Error("the haslegend's value is true. please config the legend, or you set the haslegend to false")
  }
  const { mapColor, text, formatter, rangeValue, rangeColor } = legend || {}

  // 缩放事件
  let transform =  d3.zoomIdentity //{ k: 700, x: 0, y: 0} //
  const zoom = d3.zoom().scaleExtent([1, 10]).on("zoom", zoomed)
  function zoomed(e) {
    transform = e.transform
    d3.select("#drager").attr("transform", transform)
  }

  const projection = d3.geoMercator().center([60.59019654372251, 60.683209512257383]).scale(700).translate([transform.x, transform.y])

  const svg = d3.select("#drager").call(zoom)
  // 地图坐标映射
  const path = d3.geoPath().projection(projection)

  
  var myColor = d3.scaleLinear()
  .range(rangeColor || ["white", "#69b3a2"])
  .domain([1,2000])

  const getColor = (i) => {
    if (formatter) {
      if (typeof formatter === 'function') {
        return formatter(i)
      }
      throw Error('legend.formatter should be a function')
    }
    return myColor(i.properties[rangeValue || 'size'])
  }

  const handleBlankbord = (e) => {
    // 移出区域就隐藏弹窗
    if (e.target.id === 'blankborad') {
      d3.select('#poper').attr('style', 'display: none') 
    } 
  }

  const handlePathMove = (e, i) => {
    const { target, nativeEvent: { offsetX, offsetY } } = e
    // 聚焦的这块地，赋予外面传进来的样式
    for (const i in hoverStyle) {
      d3.select(target).attr(i, hoverStyle[i])
    }
    if (!isDraw) {
      const { properties: { name, size } } = i
      // 鼠标移动显示的时候有点卡顿
      d3.select('#poper').attr('style', `opacity: 1; visibility: visible; transform: translate3d(${offsetX + 30}px, ${offsetY + 30}px, 0px);`)
      setPopData({ name, value: size})
    }
  }
  const handlePathMout = (e, i) => {
    d3.select(e.target).attr('fill', getColor(i))
  }

  const handlePathClick = (e, i) => {
    const [x, y] = projection.invert(d3.pointer(e, svg.node()))
    onClick([x, y], i)
  }

  //绘制区域的文字, 文字的大小应该是外部按照自己的规则定义的，不应该在这里定义，当然也可以设计高中低的规则去设计文字大小
  const handleTextMover = (e, i) => {
    for (const is in hoverStyle) {
      d3.select(`#map_id_${i.properties.id}`).attr(is, hoverStyle[is])
    }
  }
  const handleTextMout = (e, i) => {
    d3.select(`#map_id_${i.properties.id}`).attr('fill', getColor(i))
  }

  const handleDbMDown = (e) => {
    // d3.select('#poper').attr('style', 'display: none') 
    const [isRect, isCircle] = drawType
    isRect && tools.rectMd(e)
    isCircle && tools.circleMd(e)
  }
  const handleDbMMove = (e) => {
    const [isRect, isCircle] = drawType
    isRect && tools.rectMm(e)
    isCircle && tools.circleMm(e)
  }
  const handleDbMUp = (e) => {
    const [isRect, isCircle] = drawType
    isRect && tools.rectMu(e)
    isCircle && tools.circleMu(e)
  }

  // 开启缩放拖拽时关闭绘制图形功能
  function closeDraw() {
    isDraw = false
    tools.clearDrawEvent()
  }

  const openDraw = (type) => {
    isDraw = true
    svg.on("mousedown.zoom", null)
    svg.on("mousemove.zoom", null)
    svg.on("dblclick.zoom", null)
    svg.on("touchstart.zoom", null)
    svg.on("wheel.zoom", null)
    svg.on("mousewheel.zoom", null)
    svg.on("MozMousePixelScroll.zoom", null)
    tools.clearDrawEvent()

    if ([0, 1].indexOf(type) !== -1) {
      type === 0 && (drawType = [true, false, false])
      type === 1 && (drawType = [false, true, false])
    }
    if (type === 2) {
      drawType = [false, false, true]
      tools.addPolygonEvent()
    }
  }

  // 开启编辑跟开启绘制的功能得分开，关闭也一样
  function closeEdit() {
    // 关闭编辑模式的时候，把所有编辑点删除
    d3.selectAll('.edit-circle').remove()
  }

  function addRect(xy, width=0, height=0, id) {
    const [lon, lat] = projection(xy);
    /* 
    * 2021-12-27:
    * 对图形的id进行了改造，原来每个图形的id都是独一无二的
    * 改造后，把back功能里重绘的图形id进行了再次贴合
    * 配合stepArr操作日志，可实现多图形回退
    */
    _id = _id + 1;
    const attrId = id ? id.split('#')[1] : `id_${_id}`
    const hId = id || `#id_${_id}`

    console.log('_id:', _id)

    d3.select('#shape')
    .append("rect")
    .attr('id', attrId)
    .attr("class", "shaper")
    .attr('x', lon)
    .attr('y', lat)
    .attr("width", width)
    .attr("height", height)
    .style("fill", "red");

    const d3Element = d3.select(hId)
    d3Element.on('mousemove', function() {
      d3.select('#poper').attr('style', 'display: none')
    })

    return {
      type: 'rect',
      id: hId,
      d3Element,
      bounds: [],
      x: lon,
      y: lat
    }
  }
  function addCircle(xy, r, id) {
    const [lon, lat] = projection(xy);
    const attrId = id ? id.split('#')[1] : `id_${_id}`
    const hId = id || `#id_${_id}`

    d3.select('#shape')
    .append("circle")
    .attr('id', attrId)
    .attr('class', 'shaper')
    .attr("r", r)
    .attr("cx", lon)
    .attr("cy", lat)
    .attr("fill","crimson");

    const d3Element = d3.select(hId)

    d3Element.on('mousemove', function() {
      d3.select('#poper').attr('style', 'display: none')
    })

    return {
      type: 'circle',
      id: hId,
      d3Element,
      center: xy,
      r
    }
  }

  function addPolygon(points, id) {
    const attrId = id ? id.split('#')[1] : `id_${_id}`
    const hId = id || `#id_${_id}`

    const mousePoints = points.map((i) => projection(i));

    d3.select('#shape')
    .append("polygon")
    .attr('id', attrId)
    .attr('class', 'ing-polygon shaper')
    .attr("points", mousePoints + " ");

    const d3Element = d3.select(hId)

    d3Element.on('mousemove', function() {
      d3.select('#poper').attr('style', 'display: none')
    })

    return {
      type: 'polygon',
      id: hId,
      d3Element,
      mousePoints,
      points
    }
  }

  function openEdit({ xy, currentShapeIndex, pointIndex }) {
    const [lon, lat] = projection(xy)
    const lastShape = shapeArr.length - 1 || 0
    const index = (!currentShapeIndex && currentShapeIndex !== 0) ? lastShape : currentShapeIndex

    _id = _id + 1
    d3.select('#editor')
    .append("circle")
    .attr('id', `id_${_id}`)
    .attr('class', `edit-circle edit-circle-${lastShape} shaper`)
    .attr("r", 4)
    .attr("cx", lon)
    .attr("cy", lat)
    .attr("fill","crimson")
    .attr('currentShapeIndex', index)
    .attr('pointIndex', pointIndex)
    .call(d3.drag()
      .on("start", tools.dragstarted)
      .on("drag", tools.dragged)
      .on("end", tools.dragended)
    );

    const d3Element = d3.select(`#id_${_id}`)

    d3Element.on('mousemove', function() {
      d3.select('#poper').attr('style', 'display: none')
    })

    return {
      type: 'circle',
      id: `#id_${_id}`,
      d3Element,
      center: xy,
      r: 4
    }
  }

  const tools = {
    getDistance(point1, point2) {
      let xs = 0;
      let ys = 0;

      xs = point2[0] - point1[0];
      xs = xs * xs;

      ys = point2[1] - point1[1];
      ys = ys * ys;

      return Math.sqrt(xs + ys);
    },
    
    rectMd(e) {
      shouldAppear = true;
      const mouse = d3.pointer(e, svg.node());
      const [x, y] = projection.invert(d3.pointer(e, svg.node()))

      mousestart = mouse;
      start = [x, y]
      // shaper.attr("y", mouse[1]).attr("x", mouse[0]);
      shaper = addRect([x, y])
      shaper = { ...shaper , x, y}
    },
    rectMm(e) {
      // 矩形的宽高也是按照鼠标的点来计算的，如果需要就自己按照经纬度去计算真实的宽高
      const [lon1, lat1] = mousestart
      const [x1, y1] = start

      const [lon2, lat2] = d3.pointer(e, svg.node());
      const [x2, y2] = projection.invert(d3.pointer(e, svg.node()))
      
      if (shouldAppear) {
        let rectx, recty, rectwidth, rectheight;
        if (lon2 < lon1) { // if cursor moved left
          rectx = x2;
          rectwidth = lon1 - lon2;
        } else {  // if cursor moved right
          rectx = x1;
          rectwidth = lon2 - lon1;
        }

        if (lat2 < lat1) { // if cursor moved up
          recty = y2;
          rectheight = lat1 - lat2;
        } else {  // if cursor moved down
          recty = y1;
          rectheight = lat2 - lat1;
        }

        // 这里的宽高是应该用鼠标坐标计算呢，还是已经纬度计算呢？
        const [lon, lat] = projection([rectx, recty])
        // shaper.d3Element
        d3.select(shaper.id)
          .attr('x', lon)// 这里的值得经过这样的转化，才画的对
          .attr('y', lat)
          .attr('width', rectwidth)
          .attr('height', rectheight)

        // const [x, y] = projection.invert(d3.pointer(e, svg.node()))
        shaper = { ...shaper , width: rectwidth, height: rectheight }
      }
    },
    rectMu(e) {
      shouldAppear = false;
      const width = shaper.d3Element.attr('width')
      const height = shaper.d3Element.attr('height')

      if (width !== '0' || height !== '0') {
        const [x1, y1] = projection.invert(d3.pointer(e, svg.node()))
        const { x, y } = shaper
        const bounds = [[x, y], [x1, y], [x, y1], [x1, y1]]
        shaper = { ...shaper , x1, y1, bounds }

        shapeArr.push({
          shaper,
          editPoints: [x1, y1]
        })

        shaper.d3Element.attr('stroke-width', 4)

        const { d3Element } = openEdit({ xy: [x1, y1] })
        
        const mArr = historyi.get(shaper.id) || []
        historyi.set(shaper.id, [...mArr, {
          shaper,
          editElement: [d3Element],
          editPoints: [x1, y1]
        }])
        stepArr.push(shaper.id)
        afterDraw({shaper, shapeArr, historyi, closeDraw})
        return
      }
      shaper.d3Element.remove()
    },
    rectCc(e) {
      const mouse = d3.pointer(e, svg.node());
      console.log('click:', projection.invert(d3.pointer(e, svg.node())))
    },

    circleMd(e) {
      shouldAppear = true
      const mouse = d3.pointer(e, svg.node());
      const [x, y] = projection.invert(mouse)
      mousestart = mouse;
      shaper = addCircle([x, y], 0)
      shaper = { ...shaper, x , y, center: [x, y]}

    },
    circleMm(e) {
      if (shouldAppear) {
        const mouse = d3.pointer(e, svg.node());
        const [x, y] = projection.invert(mouse)

        // 这里距离的计算还是用鼠标的坐标点来计算的。。。绘制距离，真实距离可以按照坐标点来计算
        const distance = Math.round(tools.getDistance(mouse, mousestart));

        // shaper.d3Element.attr('r', distance)
        d3.select(shaper.id).attr('r', distance)
        shaper = { ...shaper, r: distance, editor: [x, y] }
      }
    },
    circleMu(e) {
      shouldAppear = false
      const r = shaper.d3Element.attr('r')
      // const mouse = d3.pointer(e, svg.node());
      const [x, y] = projection.invert(d3.pointer(e, svg.node()))

      if (r !== '0') {
        shapeArr.push({
          shaper,
          editPoints: [x, y]
        })

        shaper.d3Element.attr('stroke-width', 4)
        const { d3Element } = openEdit({ xy: [x, y] })

        const mArr = historyi.get(shaper.id) || []
        historyi.set(shaper.id, [...mArr, {
          shaper,
          editElement: [d3Element],
          editPoints: [x, y]
        }])
        stepArr.push(shaper.id)
        afterDraw({shaper, shapeArr, historyi, closeDraw})
        return
      }
      // 点击的时候会触发mouseDown,所以会加进来很多当前图形，所以在up的时候，就把这些图形移除
      shaper.d3Element.remove()
    },
    circleCc(e) {
      console.log('click:', projection.invert(d3.pointer(e, svg.node())))
    },
    addPolygonEvent() {
      // click跟dblclick的互相冲突作用好恶心哦，还得另外模拟
      const polygonClick = clickcancel()
      d3.select("svg").call(polygonClick)
      polygonClick.on("click", (e) => {
        shouldAppear = true
        const mouse = d3.pointer(e, svg.node());
        const [x, y] = projection.invert(d3.pointer(e, svg.node()))

        // 全局变量
        points =  _.uniqWith([...points, [x, y]], _.isEqual)
        msPoints =  _.uniqWith([...msPoints, mouse], _.isEqual)

        d3.select('.ing-polygon').remove()
        if (shouldAppear) {
          shaper = addPolygon(points)
          shaper = { ...shaper, points, msPoints }
        }
      })
      polygonClick.on("dblclick", (e) => {
        /*
        * 双击结束绘制的时候，shaper还是上一个图形，points肯定有值，怎么处理呢？
        * 双击结束后把shaper清空就好，因为她拖动编辑点的时候，会重新赋值shaper
        */

        shouldAppear = false
        msPoints = []
        points = []
        if (shaper.points) {
          shaper.d3Element.attr('class', 'polygon shaper')
          const lastShape = shapeArr.length
          const l = shaper.points.length

          if (l <= 2) {
            // 双击的时候检测到不足3个点，就把加入的初始化图形删除，并把对应的编辑点都删除
            shaper.d3Element.remove()
            d3.selectAll(`.edit-circle-${lastShape}`).remove()
            // 虽然这里删除了不成形的图形，但是shaper还是赋值了，所以要在这里把shaper清空
            shaper = {}
          }  else {
            // 没加入过shapeArr的才能加入
            const flag = stepArr.indexOf(shaper.id) < 0
            // 之所以要先push，再绘制拖拽点的原因是，在绘制的时候要读取shapeArr的最新长度
            flag && shapeArr.push({
              shaper,
              editPoints: shaper.points
            })

            shaper.d3Element.attr('stroke-width', 4)

            const elements = []

            shaper.points.forEach((i, index) => {
              const { d3Element } = openEdit({ xy: i, pointIndex: index })
              elements.push(d3Element)
            })

            let mArr = historyi.get(shaper.id) || []
            // mArr = mArr.filter((i) => i.editElement.length === i.editPoints.length)
            console.log(stepArr)
            // 从这里打印stepArr来看，stepArr里有没有成型的多边形的id
            // 所以回退的时候，有时候没有回退，因为此时他回退了个不存在的图形
            // 要解决的问题就是，无效的图形不要加到这里来
            historyi.set(shaper.id, [...mArr, {
              shaper,
              editElement: elements,
              editPoints: shaper.points
            }])
            stepArr.push(shaper.id)
            afterDraw({shaper, shapeArr, historyi, closeDraw})
          }
        }
        shaper = {}
      })
    },
    editPolygon([x, y], points, pointIndex) {
      const { mousePoints, points: rpoints } = shaper

      /* mousePoints.forEach((i, index) => {
        const f1 = Math.abs(i[0] - i[1])
        const f2 = Math.abs(mouseIt[0] - mouseIt[1])
        
        * 因为计算的时候会产生小数循环问题导致找点找不到，所以不判断两点坐标相等
        * 改判断两点坐标差在4以内就可以，因为拖拽圆点的半径是4
        * 2021-12-07: 我想到了更好的办法，直接attr取他在编辑哪个下标的点不就好了吗！！！
        
        const f3 = Math.abs(f1 - f2) <= 4

        if (f3) {
          console.log('Math.abs(f1 - f2):', index, Math.abs(f1 - f2))
        }

        // itIndex是全局变量，用来记录拖动点的index位置
        f3 && (itIndex = index)
      }) */

      mousePoints[pointIndex] = [x, y]
      rpoints[pointIndex] = points
      shaper.d3Element.attr('points', mousePoints)
      shaper = { ...shaper, points: rpoints, mousePoints}
    },
    clearDrawEvent() {
      svg.on('click', null)
      svg.on("mousedown", null);
      svg.on("mousemove", function(e) {
        // 移出区域就隐藏弹窗
        if (e.target.id === 'blankborad') {
          d3.select('#poper').attr('style', 'display: none') 
        }
      });
      svg.on("mouseup", null);
    },
    clearAllShape() {
      d3.selectAll('.shaper').remove()
      shapeArr = []
      shaper = {}
      historyi.clear()
      stepArr = []
    },
    dragstarted(e) {
      shouldAppear = true
      const currentShapeIndex = d3.select(this).attr('currentShapeIndex')
      /*
      * 拖动点的时候，也会重置shaper
      * 这里要用深拷贝的原因是，后面editPolygon方法里会重新覆盖shaper, 会影响到历史shaper
      * 绘制多边形后，shaper是被清空的，所以多边形的情况下，shaper需要从shapeArr里来
      * shaper = shaper.id ? shaper : _.cloneDeep(shapeArr[currentShapeIndex].shaper)
      * shaper的赋值直接从这里来，不需要双击的时候来确定，因为多边形的双击功能有shaper赋值的冲突，要改成单机图形才是选中
      * 上面的想法是在想屁吃，多边形的单击是绘制，所以单击不能打开编辑，只能做双击
      */
      shaper = _.cloneDeep(shapeArr[currentShapeIndex].shaper)
      console.log('shaper1:', shapeArr)
      /*
      * 在切换画笔的时候，会导致之前绘制的图形编辑功能失效
      * 所以在拖动编辑点的时候，不仅要判断是哪个图形在编辑，还要判断是什么类型的图形在编辑，打开它的编辑功能
      * 大多数情况下其实用不着，因为打开编辑的就是当前画笔下的图形
      * 但是如果他绘制完毕后，点了别的画笔，但是又没画，而是直接去拖动了上一个图形的编辑点，就会出现问题
      * 可以在点击画笔的时候，把编辑点都清空，也可以写下面一段代码去指定开启的画笔
      */
      const { type } = shaper
      type === 'rect' && (drawType = [true, false, false])
      type === 'circle' && (drawType = [false, true, false])
      type === 'polygon' && (drawType = [false, false, true])
    },

    dragged(e) {
      const points = projection.invert(d3.pointer(e, svg.node()))
      const [isRect, isCircle, isPolygon] = drawType
      const [cx, cy] = d3.pointer(e, svg.node())
      const pointIndex = d3.select(this).attr('pointIndex')

      // 拖动点的位置变更, 因为拖动点不需要知道地理坐标，所以可以直接赋值鼠标坐标，也可以用地理坐标projection一下就可以
      d3.select(this).attr("cx", cx).attr("cy", cy);

      /*
      * 绘制两个相同的图形的时候，只有最后一个编辑功能是正常的，后面的start点的位置都会取最后一个的start点
      * 所以在拖动编辑点的时候,得重新赋值它的mousestart点, 并且如果是rect不仅要更新mousestart，还要更新start
      */
      if (isRect) {
        const { x, y } = shaper
        mousestart = projection([x, y])
        start = [x, y]
        tools.rectMm(e)
      }

      if (isCircle) {
        mousestart = projection(shaper.center)
        tools.circleMm(e)
      }

      isPolygon && tools.editPolygon([cx, cy], points, pointIndex)
    },

    dragended(e) {
      /*
      * 目前这里多边形在编辑的时候会出现绘制不正确的情况，初步判断是在编辑点拖动结束后
      * 并没有执行这个结束方法，没有关闭本次编辑，导致下一个拖动点还在编辑状态中，点的index还是上一个
      * 所以出现了绘制错误的情况，但是因为是偶现，且是框架自带的事件的问题，很难解决
      */
      console.log('拖动结束')
      shouldAppear = false

      /*
      * 编辑过的图形，是否要从shapeArr中挑出来重新放进去（或者更新改shape）？
      * 要重新更新一下shape，因为最后业务中发送过去是要更新后的数据
      */
      const currentShapeIndex = d3.select(this).attr('currentShapeIndex')
      // const pointIndex = d3.select(this).attr('pointIndex')
      const [x, y] = projection.invert(d3.pointer(e, svg.node()))

      /*
      * 在拖动的时候要区分是rect，circle，polygon，因为polygon的编辑点是长度>2的数组
      * 所以不管是editPoints还是editElement都要分情况赋值
      * 
      */
      const { type, points, id } = shaper

      /* 
      * 这里polygon的编辑点油问题，应该是找到正在拖动的那个点，然后把points里的该点替换掉，然后在赋值到这里
      * 因为shaper取的shapeArr的，所以无论shaper改了多少次，从shapeArr里取就只有一个相同的值
      */

      const editPoints = {
        'rect': [x, y],
        'circle': [x, y],
        'polygon': _.cloneDeep(points) // 不知道为啥！！，这里不深拷贝的话points更新不了！！！
      }

      // 照道理这里不用数组格式的，但是不用数组下面在移除的时候他喵最后一个老是报错，不知道为啥！！！懒得想
      const editElement = {
        'rect': [d3.select(this)],
        'circle': [d3.select(this)],
        'polygon': [d3.selectAll('.edit-circle')]
      }
      /* 
      * 之前一直想不起来，为啥最后要这样赋值一下，现在才想到
      * 因为拖动点之后，要把shapeArr里的那个最终的图形覆盖掉
      */
      shapeArr[currentShapeIndex].shaper = shaper
      
      const mArr = historyi.get(shaper.id) || []
      historyi.set(shaper.id, [...mArr, {
        shaper,
        editElement: editElement[type],
        editPoints: editPoints[type]
      }])
      stepArr.push(shaper.id)
      afterDraw({shaper, shapeArr, historyi, closeDraw})
      console.log('88:', historyi, shapeArr, stepArr)
    },
    findShape(id) {
      /*
      * 原先是从shapeArr里找对应的图形，改成了从historyi里找，不知道会不会有问题, 暂时没发现什么问题
      * 2021-12-06: 如果只是对比id，当不断重复编辑同一个图形的时候，他在historyi里就会反复加入，导致id会重复
      * 如果shaper从shapeArr里找，改大小的编辑点从history里找，找id相同的shaper的最后一个。居然真的行。。。
      */
      const it = {}
      shapeArr.forEach((i, index) => {
        if (i.shaper.id === `#${id}`) {
          it.index = index
          it.it = i
        }
      })
      const il = historyi.get(`#${id}`).length
      it.editPoints = historyi.get(`#${id}`)[il - 1].editPoints
      return it
    },
    back() {
      /*
      * 如果不仅做后退，还要做前进的话，就不能取截historyi，而是应该按照下标去回退
      * 但是下标的方法会导致真实historyi的length不变，导致去取length - 2的值一直没变更
      * 所以正确的回退与前进方法，应该是两个数组，一个数组截取后，把截取的数据放到另一个数组头部
      * 即：[0, 1, 2, 3(截掉)] -> [3(加入), 4, 5] 这样就前进后退自如了
      * 目前没有前进功能的要求，暂时就不做了，直接截取historyi吧

      * 还有一个问题，回退删除图形的时候，第一次没问题，但是第二次开始, 因为图形其实不是原来的图形了
      * 是根据historyi里的数据重新绘制重现的图形，所以，从historyi里取d3Element其实并不是那个重现的图形，所以无法删除
      * 想了两个办法：
      * 1、重现建个g组，把重现的图形都放进这个新的g组里，每次回退就清空g组
      * 2、点回退的时候从shaper里取d3Element，操作完之后再把shaper清空（因为如果下一步是绘制polygon就会有问题）
      * 然后重新绘制上一个图形的时候赋值shaper
      * 
      * 我觉得第二种改动更小，靠谱些

      * 单个模式下，回退的步骤：
      * 1、把最后一个图形删除, 并且把该图形的编辑点也删除
      * 2、把目前的最后一个图形拿出来绘制，并把编辑点也画上

      * 多个模式下，回退的步骤：
      * 2021-12-07: 讲实话，我暂时也不知道多个模式该怎么设计回退。。
      * 先去找到该id的图形移除，再添加回退图形？我看可行
      * 如果当前的跟下一个的图的id相同，说明是同一个图的回退，就不要移除，否则就移除
      * 这样就能兼容多个跟单个模式的回退了
      * 2021-12-08: 不行啊，如果是连续操作，是可以直接按照id移除
      * 但是如果是先添加圆形，再添加矩形，再编辑圆形，再去回退的时候，他就直接删除圆形了。。而不是到圆形的上一个状态
      * 咋整！！！。。。。难道是要把所有图形都删掉，然后再按照historyi渲染出来吗？哈哈哈哈
      * 2021-12-13: 所以historyi应该是一个二维数组
      * 第一层记录的是绘制的图形（id不同的图形），第二层应该是某个图形（id相同）的所有历史状态，这样设计应该不会有问题了
      * 2021-12-23: 突然想到，historyi设计为Map比较好,以id为键，值为数组,每个图形的所有历史状态都在这个数组里
      * 回退的时候，去检查当前的id的数组的长度，为0就去绘制上一个id的数组
      * 2021-12-27: 在回退的时候，不应该是去直接取最后一个，而是应该去操作日志stepArr里取最后一个
      * （stepArr是用来记录他编辑的顺序，即操作日志）
      * 2021-12-28: 删除当前图形的时候，做了编辑点重绘，所以索性这里回退的时候也加上吧
      */

      let cKey = stepArr[stepArr.length - 1]
      let cItem = historyi.get(cKey)

      if (!historyi.size || !cItem) {
        console.log('不能回退更多啦1～')
        tools.clearAllShape()
        return
      }
      /*
      * 2021-12-23: 检查他本身的arr的长度是否为0，如果不为0就继续回退本身，否则回退上一个id的
      * 把对应的图形先删除，然后把操作顺序里做后一个删除，再把编辑按钮都删除
      * 2021-12-27: 这里原来其实走了很多弯路，以前的逻辑的注释都删了，只能说太年轻，收获就是：操作日志yyds
      */
      // 删掉当前的图形
      d3.select(cKey).remove()
      stepArr.splice(stepArr.length - 1, 1)

      if (cItem.length > 0) {
        historyi.get(cKey).splice(cItem.length - 1, 1)
        cItem = historyi.get(cKey)
        // 先删再画，取最后一个的时候就比较方便，所以就得再次判断cItem的长度
        cItem.length && tools.backDraw(cItem[cItem.length - 1])
      }
      // 当该id的记录都删完了后，就从history跟shapeArr里把该id的项删掉,吧所有的编辑点也删除
      if (stepArr.indexOf(cKey) === -1) {
        historyi.delete(cKey)
        shapeArr = shapeArr.filter((i, index) => {
          if (i.shaper.id === cKey) {
            // 如果这个图形的历史状态都回退完了，就把她他的编辑点删掉
            d3.selectAll(`.edit-circle-${index}`).remove()
          }
          return i.shaper.id !== cKey
        })
      }
    },
    backDraw(obj) {
      let {
        shaper: { type, x, y, width, height, center, r, id },
        editPoints,
        editElement
      } = _.cloneDeep(obj)
      
      if (type === 'rect') {
        shaper = addRect([x, y], width, height, id)
        const [lon, lat] = projection(editPoints)
        editElement[0].attr('cx', lon).attr('cy', lat)
        /*
        * 编辑点的处理好麻烦，因为在数据层面，没有图形跟编辑点的组合结构，直接回退的时候关闭得了
        * 还有种办法，就是找到图形上的一个点，然后把编辑点绘制到这个点上
        * 但是，如果是能多区域绘制的情况下，就需要遍历所有图形，把编辑点重新绘制上去
        * 又想到一种，historyi存图形跟编辑点的组合结构, 靠谱！！！
        */
        /*
        * 编辑的时候编辑点的逻辑还是绕，我觉得肯定是我的思路出问题了，先停下来不做了，仔细再想想
        * 2021-12-03: 我觉得从交互入手改造比较好,绘制下一个图形的时候，就把前面的图形的编辑点都删除，双击图形进入编辑模式
        * 但是历史记录里的图形都是不进shapeArr的，找图形的时候都是从shapeArr里找的，咋整
        * 2021-12-06: 从historyi里找啊。。。。但是会碰到问题，详情见findShape方法里的注释
        */
      }

      if (type === 'circle') {
        shaper = addCircle(center, r, id)
        const [lon, lat] = projection(editPoints)
        editElement[0].attr('cx', lon).attr('cy', lat)
      }

      if (type === 'polygon') {
        shaper = addPolygon(editPoints, id)
        editPoints.forEach((i, index) => {
          const [lon, lat] = projection(i)
          editElement[index].attr('cx', lon).attr('cy', lat)
        })
      }
    }
  }

  const addShape = () => {
    shapeData.forEach((i) => {
      const { type } = i
      
      if (type === 'rect') {
        const { x, y, width, height, x1, y1 } = i
        const item = _.cloneDeep({ ...addRect([x, y], width, height), ...i })
        shapeArr.push({
          shaper: item,
          editPoints: [x1, y1]
        })
        const did = `#id_${_id}`
        stepArr.push(did)
        const { d3Element } = openEdit({ xy: [x1, y1] })
        historyi.set(did, [{
          shaper: item,
          editElement: [d3Element],
          editPoints: [x1, y1]
        }])
      }

      if (type === 'circle') {
        const { center, r } = i
        const item = _.cloneDeep({ ...addCircle(center, r), ...i })
        const [x, y] = projection(center)
        const editPoint = projection.invert([x+r, y])
        shapeArr.push({
          shaper: item,
          editPoints: editPoint
        })
        const did = `#id_${_id}`
        stepArr.push(did)
        const { d3Element } = openEdit({ xy: editPoint })
        historyi.set(did, [{
          shaper: item,
          editElement: [d3Element],
          editPoints: editPoint
        }])
      }

      if (type === 'polygon') {
        const { points } = i
        const item = _.cloneDeep({ ...addPolygon(points), ...i })
        const pts = []

        shapeArr.push({
          shaper: item,
          editPoints: points
        })
        const did = `#id_${_id}`
        stepArr.push(did)
        // 得把多边形的编辑状态关闭，不然鼠标点击的时候，他就会消失。。。
        d3.select(did).attr('class', 'polygon shaper')

        points.forEach((i, index) => {
          const { d3Element } = openEdit({ xy: i, pointIndex: index })
          pts.push(d3Element)
        })
        historyi.set(did, [{
          shaper: item,
          editElement: pts,
          editPoints: points
        }])
      }
      
      _id = _id + 1
    })
  }

  useEffect(() => {
    addShape()
    // 执行了两次，看了下shapeData是一样的啊，没变化啊，奇怪
    // 因为没有放到useState里。。。。。无语
  }, [shapeData])

  return (
    <>
      <Button type="text" onClick={ closeDraw }>closeDraw</Button>
      <Button type="text" onClick={ openDraw }>openDraw</Button>

      <Button type="text" onClick={ () => { openDraw(0) } }>rect</Button>
      <Button type="text" onClick={ () => { openDraw(1) } }>circle</Button>
      <Button type="text" onClick={ () => { openDraw(2) } }>polygon</Button>

      <Button type="text" onClick={ tools.back }>back</Button>

      <Button type="text" onClick={ tools.clearAllShape }>clearAllShape</Button>

      <p> default: open draw status</p>
      
      <div id="charts" className="charts">
        <svg
          id="svgId"
          width="1000"
          height="1000"
          viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg"
          onMouseMove={handleBlankbord}
        >
          <g id="drager"
            onMouseDown={(e) => { handleDbMDown(e) }}
            onMouseMove={(e) => { handleDbMMove(e) }}
            onMouseUp={(e) => { handleDbMUp(e) }}
          >
            <rect id="blankborad" className="blankborad" width="1000" height="1000"/>
            <g id="allg">
              <g id="svgMap">
                {
                  data.map((i) => {
                    return (
                      <path
                        key={i.properties.name}
                        id={`map_id_${i.properties.id}`}
                        className='p-a'
                        d={path(i)}
                        fill={getColor(i)}
                        onMouseMove={(e) => { handlePathMove(e, i) }}
                        onMouseOut={(e) => { handlePathMout(e, i) }}
                        onClick={(e) => { handlePathClick(e, i) }}
                      />
                    )
                  })
                }
              </g>
              <g id="texts">
                {
                  data.map((i, index) => {
                    return (
                      <text
                        key={i.properties.name}
                        className={`text-${index}`}
                        x={path.centroid(i)[0]}
                        y={path.centroid(i)[1]}
                        onMouseMove={(e) => { handleTextMover(e, i) }}
                        onMouseOut={(e) => { handleTextMout(e, i) }}
                      >{i.properties.name}</text>
                    )
                  })
                }
              </g>
              <g id="shape"></g>
              <g id="editor"></g>
              
              <g className="div-heatmap">
                <foreignObject x="0" y="0" width="1000" height="1000">
                  {
                    hasHeatMap ? <HeatMap { ...{ projection, heatmapConfig } } /> : null
                  }
                </foreignObject>
              </g>
            </g>
          </g>
        </svg>
        <div id="poper" className="p-r">
          <p>name: {popData.name}</p>
          <p>value: {popData.value}</p>
        </div>
        {
          haslegend ? <Legend {...{ mapColor, text, rangeColor }} /> : null
        }
      </div>
    </>
  )
}

export default Mapr