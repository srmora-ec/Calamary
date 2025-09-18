"use client"
import React, {
  useState,
  ReactNode,
  ReactElement,
  Children,
  isValidElement,
} from "react"

interface TabProps {
  label: string
  children: ReactNode
}

export const Tab: React.FC<TabProps> = ({ children }) => {
  return <>{children}</>
}

interface TabsProps {
  children: ReactElement<TabProps> | ReactElement<TabProps>[]
}

export const Tabs: React.FC<TabsProps> = ({ children }) => {
  const [activeIndex, setActiveIndex] = useState(0)

  const tabs = Children.toArray(children).filter((child): child is ReactElement<TabProps> =>
    isValidElement(child)
  )

  return (
    <div className="w-full">
      {/* Botones */}
      <div className="flex space-x-2 border-b pb-2 mb-4">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`px-4 py-2 rounded-t-lg ${
              activeIndex === index
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {tab.props.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="p-4 border rounded-b-lg">{tabs[activeIndex].props.children}</div>
    </div>
  )
}
