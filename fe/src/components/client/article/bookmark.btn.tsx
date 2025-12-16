'use client'

import React, { useState, useEffect } from 'react';
import { Button, Tooltip, notification } from 'antd';
import { StarOutlined, StarFilled } from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import { sendRequest } from '@/utils/api';

interface IBookmarkProps {
    articleId: string;
    articleTitle?: string;
    articleUrl?: string;
    size?: 'small' | 'middle' | 'large';
    shape?: 'circle' | 'default' | 'round';
    type?: 'text' | 'link' | 'default' | 'primary' | 'dashed';
}

const BookmarkButton = (props: IBookmarkProps) => {
    const { articleId, articleTitle, articleUrl, size = 'middle', shape, type = 'text' } = props;
    const { data: session, status } = useSession();
    
    const [isSaved, setIsSaved] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    
    useEffect(() => {
        const checkStatus = async () => {
            if (status !== 'authenticated' || !articleId || !session?.user?._id) return;
            
            try {
                const res = await sendRequest<any>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/saved-articles/${articleId}/check?user_id=${session.user._id}`,
                    method: 'GET',
                    session: session,
                });
                
                if (res.data && res.data.isSaved) {
                    setIsSaved(true);
                } else {
                    setIsSaved(false);
                }
            } catch (error) {
                console.error("Lỗi kiểm tra bookmark", error);
            }
        };

        checkStatus();
    }, [articleId, session, status]);

    const handleToggleBookmark = async (e: React.MouseEvent) => {
        e.stopPropagation();
        
        if (status !== 'authenticated') {
            notification.warning({ title: "Vui lòng đăng nhập để lưu bài viết!" });
            return;
        }

        if (!session?.user?._id) {
            notification.error({ title: "Không tìm thấy thông tin người dùng!" });
            return;
        }

        setLoading(true);
        try {
            if (isSaved) {
                const res = await sendRequest<any>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/saved-articles/${articleId}?user_id=${session.user._id}`,
                    method: 'DELETE',
                    session: session,
                });
                if (res.statusCode === 200) {
                    setIsSaved(false);
                    notification.success({ title: "Đã bỏ lưu bài viết" });
                }
            } else {
                const res = await sendRequest<any>({
                    url: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/saved-articles`,
                    method: 'POST',
                    body: {
                        article_id: articleId,
                        article_title: articleTitle,
                        article_url: articleUrl,
                        user_id: session.user._id
                    },
                    session: session,
                });
                
                if (res.statusCode === 201) {
                    setIsSaved(true);
                    notification.success({ title: "Đã lưu bài viết thành công" });
                } else if (res.statusCode === 409) {
                    setIsSaved(true);
                    notification.info({ title: "Bài viết này đã được lưu trước đó" });
                } else {
                    notification.error({ title: res.message || "Không thể lưu bài viết" });
                }
            }
        } catch (error) {
            notification.error({ title: "Có lỗi xảy ra khi cập nhật trạng thái lưu" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Tooltip title={isSaved ? "Bỏ lưu" : "Lưu bài viết"}>
            <Button
                type={type}
                shape={shape}
                size={size}
                icon={isSaved ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                onClick={handleToggleBookmark}
                loading={loading}
                style={isSaved ? { color: '#faad14' } : {}}
            />
        </Tooltip>
    );
};

export default BookmarkButton;