import React from 'react';
import { GRNAttachmentDropzone, GRNAttachmentDropzoneProps } from './GRNAttachmentDropzone';

export type GRNImageUploaderProps = GRNAttachmentDropzoneProps;

/**
 * Modern attachment uploader wrapper for Liyanage Hardware (LHD) GRN records.
 */
export const GRNImageUploader: React.FC<GRNImageUploaderProps> = (props) => {
  return <GRNAttachmentDropzone {...props} />;
};

export default GRNImageUploader;
