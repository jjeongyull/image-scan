import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ChakraProvider,
  Box,
  Button,
  Image,
  Text,
  VStack,
  Container,
  Heading,
  useToast,
  Input,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Stack,
  Divider,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { FaFileUpload, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import './App.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 최대 허용 파일 크기: 10MB

const AppContainer = styled(Container)`
  background-color: #f0f4f8;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const ImagePreview = styled(Image)`
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const MotionBox = motion(Box);

const App = () => {
  const [imagePreview, setImagePreview] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const toast = useToast();

  const checkIfMobile = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  };

  const handleImageChange = (e) => {
    const selectedImage = e.target.files[0];

    if (selectedImage.size > MAX_FILE_SIZE) {
      toast({
        title: 'Error',
        description: '파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        icon: <FaExclamationCircle />,
      });
      return;
    }

    setSelectedFile(selectedImage);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    if (selectedImage) {
      reader.readAsDataURL(selectedImage);
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast({
        title: 'Error',
        description: '이미지를 선택해주세요.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        icon: <FaExclamationCircle />,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result.split(',')[1];

      try {
        const visionResponse = await axios.post('https://vision.googleapis.com/v1/images:annotate', {
          requests: [
            {
              image: {
                content: base64Image
              },
              features: [
                {
                  type: 'TEXT_DETECTION'
                }
              ]
            }
          ]
        }, {
          params: {
            key: process.env.REACT_APP_GOOGLE_API_KEY
          },
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const labels = visionResponse.data.responses[0].textAnnotations;

        const englishLabels = labels.filter(label => {
          // 언어 감지 API를 사용하여 영어 텍스트만 필터링
          return axios.post('https://translation.googleapis.com/language/translate/v2/detect', {
            q: label.description
          }, {
            params: {
              key: process.env.REACT_APP_GOOGLE_API_KEY
            },
            headers: {
              'Content-Type': 'application/json'
            }
          }).then(response => {
            return response.data.data.detections[0][0].language === 'en';
          }).catch(error => {
            console.error('언어 감지 오류:', error);
            return false;
          });
        });

        const translatedLabels = await Promise.all(englishLabels.map(async (label) => {
          try {
            const translationResponse = await axios.post('https://translation.googleapis.com/language/translate/v2', {
              q: label.description,
              target: 'ko'
            }, {
              params: {
                key: process.env.REACT_APP_GOOGLE_API_KEY
              },
              headers: {
                'Content-Type': 'application/json'
              }
            });

            return {
              original: label.description,
              translated: translationResponse.data.data.translations[0].translatedText
            };
          } catch (error) {
            console.error('번역 오류:', error);
            return {
              original: label.description,
              translated: label.description
            };
          }
        }));

        setResult(translatedLabels);
        console.log(translatedLabels)

        toast({
          title: 'Success',
          description: '이미지 분석 및 번역 성공.',
          status: 'success',
          duration: 5000,
          isClosable: true,
          icon: <FaCheckCircle />,
        });
      } catch (error) {
        console.error('이미지 분석 오류', error);
        toast({
          title: 'Error',
          description: '이미지 분석 중 오류가 발생했습니다.',
          status: 'error',
          duration: 5000,
          isClosable: true,
          icon: <FaExclamationCircle />,
        });
      }
    };

    reader.readAsDataURL(selectedFile);
  };

  useEffect(() => {
    setIsMobile(checkIfMobile());
  }, []);

  return (
    <ChakraProvider>
      <AppContainer centerContent>
        <VStack spacing={8} mt={10}>
          <Heading>이미지 분석 및 번역기</Heading>
          <MotionBox
            w="100%"
            p={4}
            borderWidth={1}
            borderRadius="lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isMobile ? (
              <Button className='btn' onClick={() => document.getElementById('fileInput').click()}>
                <FaFileUpload style={{ marginRight: '8px' }} /> 파일 선택
                <Input id="fileInput" type="file" onChange={handleImageChange} accept="image/*" style={{ display: 'none' }} />
              </Button>
            ) : (
              <Input type="file" onChange={handleImageChange} accept="image/*" mb={4} />
            )}
            {imagePreview && (
              <ImagePreview src={imagePreview} alt="Preview" w="100%" mb={4} />
            )}
            <Button className='btn' colorScheme="red" onClick={handleSubmit}>
              이미지 분석
            </Button>
          </MotionBox>
          {result && (
            <SimpleGrid columns={[1, null, 2]} spacing={4} mt={4}>
              {result.map((label, index) => (
                <Card key={index} borderWidth={1} borderRadius="lg" overflow="hidden" boxShadow="md">
                  <CardHeader bg="teal.500" color="white" fontSize="lg" fontWeight="bold" p={3}>
                    분석 결과 {index + 1}
                  </CardHeader>
                  <Divider />
                  <CardBody p={3}>
                    <Stack spacing={3}>
                      <Box>
                        <Text fontWeight="bold">원본 텍스트:</Text>
                        <Text>{label.original}</Text>
                      </Box>
                      <Box>
                        <Text fontWeight="bold">번역된 텍스트:</Text>
                        <Text>{label.translated}</Text>
                      </Box>
                    </Stack>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </VStack>
      </AppContainer>
    </ChakraProvider>
  );
};

export default App;
