"use client";
import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

/**
 * @typedef {Object} ChartConfigEntry
 * @property {string} [label]
 * @property {import('react').ComponentType} [icon]
 * @property {string} [color]
 * @property {Record<string, string>} [theme]
 */

/**
 * @typedef {Record<string, ChartConfigEntry>} ChartConfig
 */

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = {
  light: "",
  dark: ".dark"
}

/**
 * @typedef {{ config: ChartConfig }} ChartContextProps
 */

const ChartContext = React.createContext(
  /** @type {ChartContextProps | null} */ (null)
)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

/**
 * @typedef {React.ComponentPropsWithoutRef<'div'> & {
 *   config: ChartConfig,
 *   children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children']
 * }} ChartContainerProps
 */

const ChartContainer = React.forwardRef(
  /**
   * @param {ChartContainerProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  ({ id, className, children, config, ...props }, ref) => {
    const uniqueId = React.useId()
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

    return (
      (<ChartContext.Provider value={{ config }}>
        <div
          data-chart={chartId}
          ref={ref}
          className={cn(
            "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
            className
          )}
          {...props}>
          <ChartStyle id={chartId} config={config} />
          <RechartsPrimitive.ResponsiveContainer>
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        </div>
      </ChartContext.Provider>)
    );
  }
)
ChartContainer.displayName = "Chart"

/**
 * @param {{ id: string, config: ChartConfig }} props
 */
const ChartStyle = ({
  id,
  config
}) => {
  const colorConfig = Object.entries(config).filter(([, config]) => config.theme || config.color)

  if (!colorConfig.length) {
    return null
  }

  return (
    (<style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
.map(([key, itemConfig]) => {
const color =
  itemConfig.theme?.[theme] ||
  itemConfig.color
return color ? `  --color-${key}: ${color};` : null
})
.join("\n")}
}
`)
          .join("\n"),
      }} />)
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip

/**
 * @typedef {{
 *   dataKey?: string,
 *   name?: string,
 *   value?: number,
 *   color?: string,
 *   payload?: { fill?: string, [key: string]: any },
 * } & Record<string, any>} ChartPayloadItem
 */

/**
 * @typedef {Object} ChartTooltipContentProps
 * @property {boolean} [active]
 * @property {ChartPayloadItem[]} [payload]
 * @property {string} [className]
 * @property {"line" | "dot" | "dashed"} [indicator]
 * @property {boolean} [hideLabel]
 * @property {boolean} [hideIndicator]
 * @property {any} [label]
 * @property {(value: any, payload: ChartPayloadItem[]) => import('react').ReactNode} [labelFormatter]
 * @property {string} [labelClassName]
 * @property {(value: any, name: any, item: ChartPayloadItem, index: number, payload: any) => import('react').ReactNode} [formatter]
 * @property {string} [color]
 * @property {string} [nameKey]
 * @property {string} [labelKey]
 */

const ChartTooltipContent = React.forwardRef(
  /**
   * @param {ChartTooltipContentProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart()

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || "value"}`
      const itemConfig = getPayloadConfigFromPayload(config, item, key)
      const value =
        !labelKey && typeof label === "string"
          ? config[label]?.label || label
          : itemConfig?.label

      if (labelFormatter) {
        return (
          (<div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>)
        );
      }

      if (!value) {
        return null
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ])

    if (!active || !payload?.length) {
      return null
    }

    const nestLabel = payload.length === 1 && indicator !== "dot"

    return (
      (<div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}>
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const itemConfig = getPayloadConfigFromPayload(config, item, key)
            const indicatorColor = color || item.payload?.fill || item.color

            return (
              (<div
                key={item.dataKey}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}>
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn("shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]", {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent":
                              indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          })}
                          style={
                            /** @type {import('react').CSSProperties} */ ({
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor
                            })
                          } />
                      )
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center"
                      )}>
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>)
            );
          })}
        </div>
      </div>)
    );
  }
)
ChartTooltipContent.displayName = "ChartTooltip"

const ChartLegend = RechartsPrimitive.Legend

/**
 * @typedef {Object} ChartLegendPayloadItem
 * @property {string} [dataKey]
 * @property {string} [value]
 * @property {string} [color]
 */

/**
 * @typedef {Object} ChartLegendContentProps
 * @property {string} [className]
 * @property {boolean} [hideIcon]
 * @property {ChartLegendPayloadItem[]} [payload]
 * @property {"top" | "bottom"} [verticalAlign]
 * @property {string} [nameKey]
 */

const ChartLegendContent = React.forwardRef(
  /**
   * @param {ChartLegendContentProps} props
   * @param {React.Ref<HTMLDivElement>} ref
   */
  (
    { className, hideIcon = false, payload, verticalAlign = "bottom", nameKey },
    ref
  ) => {
    const { config } = useChart()

    if (!payload?.length) {
      return null
    }

    return (
      (<div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}>
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`
          const itemConfig = getPayloadConfigFromPayload(config, item, key)

          return (
            (<div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}>
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }} />
              )}
              {itemConfig?.label}
            </div>)
          );
        })}
      </div>)
    );
  }
)
ChartLegendContent.displayName = "ChartLegend"

// Helper to extract item config from a payload.
/**
 * @param {ChartConfig} config
 * @param {unknown} payloadInput
 * @param {string} key
 */
function getPayloadConfigFromPayload(
  config,
  payloadInput,
  key
) {
  if (typeof payloadInput !== "object" || payloadInput === null) {
    return undefined
  }

  const payload = /** @type {Record<string, unknown>} */ (payloadInput)

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? /** @type {Record<string, unknown>} */ (payload.payload)
      : undefined

  let configLabelKey = key

  if (
    key in payload &&
    typeof payload[key] === "string"
  ) {
    configLabelKey = /** @type {string} */ (payload[key])
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key] === "string"
  ) {
    configLabelKey = /** @type {string} */ (payloadPayload[key])
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key];
}
export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}