import React, { FC, useEffect, useState } from 'react';
import * as d3 from 'd3';

function translateAlong(path) {
	var l = path.getTotalLength();
	return function(d, i, a) {
		return function(t) {
			var p = path.getPointAtLength(t * l);
			return "translate(" + p.x + "," + p.y + ")";
		};
	};
}

const MigrationLine: FC = ({ start, end, color, Ncircles }) => {
    const [animate, setAnimate] = useState(true)
    const duration = 3000
		const line = d3.line().curve(d3.curveBasis)
	  const [x1, y1] = start
		const [x2, y2] = end
		const middle = [(x1 + x2)/2, (y1 + y2)/2-200]

    const transform = (circle, delay) => {
           const [ x1, y1 ] = start;
        d3.select(circle)
          .attr("transform", `translate(${x1}, ${y1})`)
          .transition()
          .delay(delay)
          .duration(duration)
          .attrTween("transform", translateAlong(document.querySelector('.path')))
          .on("end", () => {
              if (animate) {
                  transform(circle, 0);
              }
          });
    }
    useEffect(() => {
        // const delayDither = duration*Math.random()
        // const spread = duration/Ncircles

        // d3.range(delayDither, duration+delayDither, spread)
        //   .forEach((delay, i) =>{
				// 		console.log('ee:', delay)
				// 		transform(document.querySelector(`.circles-${i}`), delay)
				// 	});


				transform(document.querySelector('.circles'), 584)
		}, [])

		return (
			<g>
				{/* {
					d3.range(Ncircles).map(i => (
						<circle
							r="3"
							style={{fill: color, fillOpacity: 0.6}}
							className={`circles-${i}`}
							key={`circle-${i}`}
						/>
					))
				} */}
				<circle
					r="3"
					style={{fill: color, fillOpacity: 0.6}}
					className={'circles'}
				/>
				<path
					d={line([start, middle, end])}
					style={{ stroke: color, strokeWidth: '1.6px', strokeOpacity: 0.4, fillOpacity: 0 }}
					className="path"
				/>
			</g>
		)
};


export default MigrationLine;