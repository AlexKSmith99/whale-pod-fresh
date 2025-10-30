import { supabase } from '../config/supabase';

export interface GalleryPhoto {
  id: string;
  pursuit_id: string;
  photo_url: string;
  caption?: string;
  uploaded_by: string;
  uploader_name?: string;
  uploader_picture?: string;
  created_at: string;
}

export const galleryService = {
  async getPhotos(pursuitId: string): Promise<GalleryPhoto[]> {
    const { data, error } = await supabase
      .from('team_gallery')
      .select(`
        *,
        profiles:uploaded_by (
          name,
          profile_picture
        )
      `)
      .eq('pursuit_id', pursuitId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(photo => ({
      ...photo,
      uploader_name: photo.profiles?.name,
      uploader_picture: photo.profiles?.profile_picture,
    }));
  },

  async uploadPhoto(pursuitId: string, userId: string, photoUri: string, caption?: string): Promise<string> {
    try {
      // Create form data for upload
      const formData = new FormData();
      const fileExt = photoUri.split('.').pop() || 'jpg';
      const fileName = `${pursuitId}/${userId}/${Date.now()}.${fileExt}`;
      
      formData.append('file', {
        uri: photoUri,
        type: `image/${fileExt}`,
        name: fileName,
      } as any);

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Upload to team-gallery bucket
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/team-gallery/${fileName}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('team-gallery')
        .getPublicUrl(fileName);

      // Save to database
      const { data, error } = await supabase
        .from('team_gallery')
        .insert({
          pursuit_id: pursuitId,
          photo_url: urlData.publicUrl,
          caption,
          uploaded_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      return data.id;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  },

  async deletePhoto(photoId: string): Promise<void> {
    const { error } = await supabase
      .from('team_gallery')
      .delete()
      .eq('id', photoId);

    if (error) throw error;
  },
};
