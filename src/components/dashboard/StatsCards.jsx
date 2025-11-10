import React from 'react';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export default function StatsCards({ title, value, icon: Icon, bgColor, trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className={`absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8 ${bgColor} rounded-full opacity-10`} />
        <CardHeader className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{title}</p>
              <CardTitle className="text-3xl font-bold mt-2 text-slate-900">
                {value}
              </CardTitle>
            </div>
            <div className={`p-3 rounded-xl ${bgColor} bg-opacity-10`}>
              <Icon className={`w-6 h-6 ${bgColor.replace('bg-', 'text-')}`} />
            </div>
          </div>
          {trend && (
            <div className="flex items-center mt-4 text-sm">
              <span className="text-slate-600 font-medium">{trend}</span>
            </div>
          )}
        </CardHeader>
      </Card>
    </motion.div>
  );
}