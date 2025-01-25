import { Button } from '@chakra-ui/react'
import React from 'react';

const PDFAnnotator = ({ pdfUrl }) => {
  // Function to open the PDF in a new tab
  const openInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="flex"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Fullscreen button (now opens in a new tab) */}
      <Button
        onClick={openInNewTab}
        mb={3}
        bg="grassTeal"
        color="#202023"
        _hover={{
          bg: '#76b0ae',
          textDecoration: 'underline'
        }}
      >
        Open in New Tab
      </Button>

      {/* Display PDF in iframe */}
      <iframe
        src={pdfUrl}
        style={{
          width: '100%',
          maxWidth: '1000px',
          height: '80vh', // Occupy most of the viewport height
          border: '1px solid #ccc',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        title="PDF Viewer"
      ></iframe>
    </div>
  );
};

export default PDFAnnotator;
