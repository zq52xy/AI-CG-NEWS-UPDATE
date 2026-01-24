/**
 * [INPUT]: 依赖 utils/news 进行数据加载
 * [OUTPUT]: 对外提供 useNews hook
 * [POS]: 新闻数据管理 hook
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useEffect, useCallback } from 'react';
import { getAvailableDates, loadMarkdown, getTodayStr } from '../utils/news';

export function useNews() {
    const [availableDates, setAvailableDates] = useState([]);
    const [currentDate, setCurrentDate] = useState(null);
    const [markdown, setMarkdown] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState('loading'); // loading, online, refreshing, error

    // 初始化并加载日期列表
    const refresh = useCallback(async () => {
        setStatus('refreshing');


        try {
            const dates = await getAvailableDates();
            setAvailableDates(dates);

            if (dates.length > 0) {
                // 检查 URL hash 或使用最新日期
                const hashDate = window.location.hash.slice(1);
                const targetDate = dates.includes(hashDate) ? hashDate : dates[0];
                await selectDate(targetDate, dates);
            } else {
                setMarkdown(null);
            }

            setStatus('online');
        } catch (error) {
            console.error('刷新失败:', error);
            setStatus('error');
        }
    }, []);

    // 选择日期并加载内容
    const selectDate = useCallback(async (dateStr, dates = availableDates) => {
        if (!dates.includes(dateStr)) return;

        setIsLoading(true);
        setCurrentDate(dateStr);
        window.location.hash = dateStr;

        const content = await loadMarkdown(dateStr);
        setMarkdown(content);
        setIsLoading(false);
    }, [availableDates]);

    // 初始加载
    useEffect(() => {
        refresh();

        // 监听 hash 变化
        const handleHashChange = () => {
            const dateStr = window.location.hash.slice(1);
            if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                selectDate(dateStr);
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [refresh, selectDate]);

    return {
        availableDates,
        currentDate,
        markdown,
        isLoading,
        status,
        refresh,
        selectDate,
        isToday: currentDate === getTodayStr(),
    };
}
