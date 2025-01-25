import { Container, Heading, SimpleGrid, Box } from '@chakra-ui/react'
import Layout from '../components/layouts/article'
import Section from '../components/section'
import PDFAnnotator from '../components/PDFAnnotator'

const Resume = () => (
  <Layout title="Resume">
    <Container>
      <Heading as="h3" fontSize={25} mb={4} textAlign='center'>
        Resume
      </Heading>

      <SimpleGrid columns={[1, 1, 1]} gap={6}>
        <Section>
          <Box 
            borderWidth="1px" 
            borderRadius="lg"
            overflow="clip" 
            p={4} 
            boxShadow="md"
            alignContent="center"
            minHeight="50vh" // Large enough for better visibility
            minWidth="80vh"
          >
            <PDFAnnotator pdfUrl="/Resume_S.pdf"  />
          </Box>
        </Section>
      </SimpleGrid>
    </Container>
  </Layout>
);

// const Resume = () => (
//     <Layout title="Resume">
//       <Container maxW="container.xl">
//         <Heading as="h3" fontSize={30} mb={6} textAlign="center">
//           Resume
//         </Heading>
  
//         <SimpleGrid columns={[1]} gap={6}>
//           <Section>
//             <Box
//               borderWidth="2px"
//               borderRadius="lg"
//               overflow="hidden"
//               p={4}
//               boxShadow="lg"
//               display="flex"
//               justifyContent="center"
//               alignItems="center"
//               minHeight="90vh" // Large enough for better visibility
//             >
//               <PDFAnnotator pdfUrl="/Resume_S.pdf" />
//             </Box>
//           </Section>
//         </SimpleGrid>
//       </Container>
//     </Layout>
//   );
  

export default Resume
export { getServerSideProps } from '../components/chakra'