
import React from 'react';
import { Layout } from '@/components/layout/Layout';
import { Canvas } from '@/components/canvas/Canvas';

const Index = () => {
  return (
    <Layout>
      <div className="h-full">
        <Canvas />
      </div>
    </Layout>
  );
};

export default Index;
