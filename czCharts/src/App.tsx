import React, { FC, useEffect, useState } from 'react'
import 'antd/dist/antd.css'
import '@/styles/App.scss'
import * as d3 from 'd3'
import Mapr from '@/components/map'

const App: FC = () => {
  const [data, setData] = useState([])
  const [shapeData, setShapeData] = useState([])

  // 图例跟地图的颜色，目前是根据数据里的size分配的颜色，图例的文字
  const legend = {
    // mapColor: ['#ff3333', '#ffa500', '#ffff00', '#0aff00', '#00ffff'],
    text: ['超级大', '非常大', '很大', '大', '小'],
    // 按照这个色值阶梯来渲染
    rangeColor: ["white", "#69b3a2"],
    // 按照数据里的size字段的大小分配颜色
    rangeValue: 'size',
    /* 
    * mapColor跟formatter配合指定区域的颜色，rangeColor是在一定的色阶内给指定区域分配颜色
    * 自己传入分配颜色的方案,如果编写了这个方法，则rangeColor、rangeValue将失效
    */
    // formatter: (i) => {
    //   const { properties: { size} } = i
    //   if (size > 5000) {
    //     return legend.mapColor[3]
    //   }
    //   if (size > 900 && size < 5000) {
    //     return legend.mapColor[2]
    //   }
    //   if (size < 500) {
    //     return legend.mapColor[1]
    //   }
    //   return legend.mapColor[0]
    // }
  }

  // 鼠标移到地图上的样式设置
  const hoverStyle = {
    fill: 'pink',
    // ...
  }

  // 配置热力图, config item: https://www.patrick-wied.at/static/heatmapjs/docs.html
  const heatmapConfig = {
    /* 
    * points need be:
    * [{
    * x: lon,
    * y: lat,
    * value: 88
    * }]
    */
    points: [{
      x: 121,
      y: 29,
      value: 90
    }, {
      x: 121,
      y: 31,
      value: 60
    }],
    config: {
      backgroundColor: 'transparent',
      // ...
    }
  }

  // 迁徙图数据格式（暂时没这个功能）
  const transData = [
    [{ name: '杭州', point: [121, 29] }, { name: '新疆', point: [82, 40] }],
    [{ name: '黑龙江', point: [127, 47]}, { name: '云南', point: [101, 23] }],
    [{ name: '新疆', point: [82, 40] }, { name: '云南', point: [101, 23] }]
  ]

  // 地图区域的经纬度数据
  const getdata = async () => {
    const { features } = await d3.json("zhejiang.json")
    setData([...features])
  }

  // 绘制后
  const handleAfterDraw = ({shaper, shapeArr, historyi, closeDraw}) => {
    // 这里的绘制的图形的宽高，半径等都不是真正的地理值，需要自己转化一下
    // console.log('finish draw:', shaper, shapeArr, historyi)
  }

  // 地图点击事件
  const handleClick = (point, item) => {
    console.log('click:', point, item)
  }

  useEffect(() => {
    getdata()
    setShapeData([{
      height: 210,
      type: "rect",
      width: 202,
      x: 84.57257282562696,
      x1: 101.10649777083071,
      y: 49.057649454760025,
      y1: 36.51131732124458
    }, {
      center: [70.65788351530698, 35.25131861741529],
      r: 100,
      type: "circle",
      x: 70.65788351530698,
      y: 35.25131861741529  
    }, {
      type: "polygon",
      points: [[118.37708273834555, 44.92924081193541],[93.98545088849049, 21.475392188771657],[121.73297839554034, 20.48187640003869]]
    }])
  }, [])

  return (
    <div className="app">
      <Mapr
        shapeData={ shapeData }
        afterDraw={ handleAfterDraw }
        onClick={ handleClick }
        haslegend={ true }
        data={data}
        legend={legend}
        hoverStyle={hoverStyle}
        hasHeatMap = {true}
        heatmapConfig={heatmapConfig}
      />
    </div>
  )
}

export default App