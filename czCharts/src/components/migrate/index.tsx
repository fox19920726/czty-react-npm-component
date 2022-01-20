import React, { FC, useEffect, useState } from 'react';
import * as d3 from 'd3'
import { destination, point, bearing, greatCircle } from '@turf/turf'

function translateAlong(path) {
	var l = path.getTotalLength()
	return function(d, i, a) {
		return function(t) {
			const { x, y } = path.getPointAtLength(t * l)
			return `translate(${x},${y})`
		};
	};
}

const MigrationLine: FC = ({ start, end, color, projection, index, migrateStyle, dV }) => {
    const duration = 5000
		// 这里的line方法，如果希望得到曲线就line([start, middle, end])
		// const line = d3.line().curve(d3.curveBasis)
		// const line = d3.line().curve(d3.curveBundle.beta(0.5))
		const line = d3.line().curve(d3.curveCatmullRom.alpha(0))
		const [x1, y1] = start
		const [x2, y2] = end
		// const middle = [(x1 + x2)/2, (y1 + y2)/2 + dV]
		let middle = []
		if (x1 < x2) {
			middle = [(x1 + x2)/2, (y1 + y2)/2 + dV]
		} else {
			middle = [(x1 + x2)/2 + 4, (y1 + y2)/2 + dV]
		}

    const transform = (circle, delay) => {
			d3.select(circle)
				.transition()
				.delay(delay)
				.duration(duration)
				.attrTween("transform", translateAlong(document.querySelector(`.migrate-path-${index}`), projection))
				.on("end", () => {
					transform(circle, 0)
				})
    }
    useEffect(() => {
			// 这里的584原来是根据Ncircles字段来计算的，这里直接写定值了
			transform(document.querySelector(`.migrate-circles-${index}`), 500)
		}, [])

		return (
			<>
				<circle
					r="10"
					style={{fill: color, fillOpacity: 0.8}}
					className={`migrate-circles-${index}`}
				/>
				{
					// <circle
					// 	r={Math.round(getDistance(projection(middle), projection(start)))}
					// 	cx={projection(middle)[0]}
					// 	cy={projection(middle)[1]}
					// 	style={{fill: color, fillOpacity: 0.8}}
					// 	className={`cc-${index}`}
					// />
				}
				{
					!migrateStyle || migrateStyle === 'line' ? 
					<path
						d={line([projection(start), projection(end)])}
						style={{ stroke: color, strokeWidth: '2px', strokeOpacity: 0.4, fillOpacity: 0 }}
						className={`migrate-path-${index}`}
					/>
					: 
					<path
						d={line([projection(start), projection(middle), projection(end)])}
						style={{ stroke: color, strokeWidth: '2px', strokeOpacity: 0.4, fillOpacity: 0}}
						className={`migrate-path-${index}`}
					/>
				}
			</>
		)
};

export default MigrationLine;